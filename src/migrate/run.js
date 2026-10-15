const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");

const { readCsvRows } = require("../common/csv.js");
const { readJsonFile } = require("../common/util.js");
const { CustomerDeduper, buildCustomerRow, collapseUnidentified, applyCustomerNotes } = require("./customers.js");
const { processVehicles, ensureNhtsa, parseNhtsaDump } = require("./vehicles.js");
const { processInventory, formatInventoryMoney } = require("./inventory.js");
const { processOrders, parseMoneyAmount, firstNonEmpty } = require("./orders.js");
const { processLineItems } = require("./items.js");
const { addFilesToZip, getMigrationInstructions } = require("./pack.js");
const { subtractMoney } = require("../common/money.js");

const { createStackedTracker, PROGRESS_STAGE } = require("../common/progress.js");

function loadRepDepositTotals(inputDeposits, requiredColumns) {
    if (!inputDeposits || !fs.existsSync(inputDeposits)) return new Map();
    const rows = readCsvRows(inputDeposits, requiredColumns);
    const totals = new Map();

    for (const row of rows) {
        const orderNumber = String(row.INV_NUM || "").trim();
        if (!orderNumber) continue;
        const amount = parseMoneyAmount(row.AMOUNT);
        if (!Number.isFinite(amount)) continue;

        const type = String(row.TYPE_TRANS || "").trim().toUpperCase();
        if (type === "DEPOSIT" || type === "PAYMENT") {
            totals.set(orderNumber, (totals.get(orderNumber) || 0) + amount);
        }
    }
    return totals;
}

function buildRepOrderRows(referralRows, depositTotals) {
    const byInvoice = new Map();

    for (const row of referralRows) {
        const orderNumber = String(row.INV_NUM || "").trim();
        if (!orderNumber) continue;

        let summary = byInvoice.get(orderNumber);
        if (!summary) {
            summary = {
                invNum: orderNumber, status: "", customerName: "", customerId: "",
                salesperson: "", salesperson2: "", orderDate: "", orderTotal: "",
                balanceDue: "", depositAmount: "", vehicleId: "", newVehicleId: "",
                autoId: "", pickupDate: "", deliveryDate: "", notes: "",
            };
            byInvoice.set(orderNumber, summary);
        }

        summary.status = firstNonEmpty(summary.status, row.INV_STATUS, row.STATUS);
        summary.customerName = firstNonEmpty(summary.customerName, row.CUST_NAME);
        summary.customerId = firstNonEmpty(summary.customerId, row.CUSTOMER_ID, row.CUST_UID, row.CUST_ID);
        summary.salesperson = firstNonEmpty(summary.salesperson, row.SALESPRSN);
        summary.salesperson2 = firstNonEmpty(summary.salesperson2, row.SALESPRSN2);
        summary.orderDate = firstNonEmpty(summary.orderDate, row.INV_DATE, row.TRANS_DATE);
        summary.orderTotal = firstNonEmpty(summary.orderTotal, row.INV_TOTAL);
        summary.balanceDue = firstNonEmpty(summary.balanceDue, row.BAL_DU);
        summary.depositAmount = firstNonEmpty(summary.depositAmount, row.DEP_AMT);
        summary.vehicleId = firstNonEmpty(summary.vehicleId, row.VEHICLE_ID);
        summary.newVehicleId = firstNonEmpty(summary.newVehicleId, row.NEW_AUTO_ID);
        summary.autoId = firstNonEmpty(summary.autoId, row.AUTO_ID);
        summary.pickupDate = firstNonEmpty(summary.pickupDate, row.PICKUP_DATE);
        summary.deliveryDate = firstNonEmpty(summary.deliveryDate, row.DELIVERY_DATE);

        const noteText = [row.JOB_DESC, row.JOB_DESC2, row.WORK_DESC, row.WORK_DESC2, row.WORK_DESC3, row.WORK_DESC4, row.WORK_DESC5, row.REFERENCE]
            .map((v) => String(v || "").trim())
            .filter(Boolean)
            .join(" | ");
        summary.notes = firstNonEmpty(summary.notes, noteText);
    }

    const normalized = [];
    for (const summary of byInvoice.values()) {
        const depositFromHeader = parseMoneyAmount(summary.depositAmount);
        const depositFromPayments = depositTotals.get(summary.invNum);
        const deposit = Number.isFinite(depositFromHeader) ? depositFromHeader : (Number.isFinite(depositFromPayments) ? depositFromPayments : 0);

        const totalFromHeader = parseMoneyAmount(summary.orderTotal);
        const balanceFromHeader = parseMoneyAmount(summary.balanceDue);
        const total = Number.isFinite(totalFromHeader) ? totalFromHeader : 0;
        const balanceDue = Number.isFinite(balanceFromHeader) ? balanceFromHeader : subtractMoney(total, deposit);

        normalized.push({
            INV_NUM: summary.invNum,
            CUSTOMER_ID: summary.customerId,
            CUST_ID: summary.customerId,
            CUST_UID: "",
            CUST_NAME: summary.customerName,
            INV_DATE: summary.orderDate,
            TYPE: "RETAIL",
            INV_STATUS: summary.status,
            SALESPRSN: summary.salesperson,
            SALESPRSN2: summary.salesperson2,
            AUTO_ID: summary.autoId,
            VEHICLE_ID: summary.vehicleId,
            NEW_AUTO_ID: summary.newVehicleId,
            JOB_DESC: summary.notes,
            JOB_DESC2: "", WORK_DESC: "", WORK_DESC2: "", WORK_DESC3: "", WORK_DESC4: "", WORK_DESC5: "", REFERENCE: "",
            INV_TOTAL: formatInventoryMoney(total),
            BAL_DU: formatInventoryMoney(balanceDue),
            DEP_AMT: formatInventoryMoney(deposit),
            PICKUP_DATE: summary.pickupDate,
            DELIVERY_DATE: summary.deliveryDate,
        });
    }

    return normalized;
}

async function runExport(options = {}, targetConfig, sharedNhtsaIndex = null) {
    const rootDir = path.resolve(__dirname, "../..");
    const targetId = targetConfig.id;
    const targetSchemaPath = path.join(rootDir, "config", "targets", `${targetId}.json`);
    const defaultSchemaPath = path.join(rootDir, "config", "schema.json");
    const schema = fs.existsSync(targetSchemaPath)
        ? readJsonFile(targetSchemaPath)
        : readJsonFile(defaultSchemaPath);
    const fields = readJsonFile(path.join(rootDir, "config", "fields.json"));

    const timestamp = new Date();
    const tracker = createStackedTracker(options);
    if (tracker) tracker.start();

    // 1. NHTSA database (use shared index if already loaded across targets)
    let nhtsaIndex = sharedNhtsaIndex;
    if (!nhtsaIndex) {
        try {
            const nhtsaSqlPath = await ensureNhtsa();
            nhtsaIndex = parseNhtsaDump(nhtsaSqlPath);
        } catch (err) {
            process.stderr.write(`Notice: Failed to fetch live NHTSA database (${err.message}). Continuing without vehicle harmonization.\n`);
        }
    }

    // 2. Customers
    const customerRawRows = readCsvRows(options.inputCustomers, fields.customer);
    const deduper = new CustomerDeduper();
    for (const row of customerRawRows) {
        deduper.add(buildCustomerRow(row, schema.customer));
        if (tracker) tracker.step(PROGRESS_STAGE.CUSTOMERS);
    }
    if (tracker) tracker.setStageCompleted(PROGRESS_STAGE.CUSTOMERS, customerRawRows.length, true);
    let customers = collapseUnidentified(deduper.records);
    customers = applyCustomerNotes(customers, timestamp);
    if (options.maxRows != null) customers = customers.slice(0, options.maxRows);

    // 3. Vehicles
    const vehicleRawRows = readCsvRows(options.inputVehicles, fields.customer);
    const onVehicleStep = tracker ? () => tracker.step(PROGRESS_STAGE.VEHICLES) : null;
    const { vehicleRecords, vehicleIdLookup } = processVehicles(
        vehicleRawRows, customers, nhtsaIndex, schema.vehicle, timestamp, onVehicleStep
    );
    if (tracker) tracker.setStageCompleted(PROGRESS_STAGE.VEHICLES, vehicleRawRows.length, true);
    let vehicles = vehicleRecords;
    if (options.maxRows != null) vehicles = vehicles.slice(0, options.maxRows);

    // 4. Inventory
    const inventoryRawRows = readCsvRows(options.inputInventory, fields.inventory);
    const onInventoryStep = tracker ? () => tracker.step(PROGRESS_STAGE.INVENTORY) : null;
    let inventory = processInventory(inventoryRawRows, schema.inventory, onInventoryStep);
    if (tracker) tracker.setStageCompleted(PROGRESS_STAGE.INVENTORY, inventoryRawRows.length, true);
    if (options.maxRows != null) inventory = inventory.slice(0, options.maxRows);

    // 5. Orders
    const depositTotals = loadRepDepositTotals(options.inputDeposits, fields.payment);
    const rawReferralRows = readCsvRows(options.inputOrders, fields.referral);
    const orderRawRows = buildRepOrderRows(rawReferralRows, depositTotals);
    const onOrderStep = tracker ? () => tracker.step(PROGRESS_STAGE.ORDERS) : null;
    const { orderRows, orderContextByInvNum } = processOrders(
        orderRawRows, customers, vehicleIdLookup, schema.order, timestamp, onOrderStep
    );
    if (tracker) tracker.setStageCompleted(PROGRESS_STAGE.ORDERS, rawReferralRows.length, true);
    let orders = orderRows;
    if (options.maxOrders != null && options.maxOrders > 0) orders = orders.slice(0, options.maxOrders);
    if (options.maxRows != null) orders = orders.slice(0, options.maxRows);

    // 6. Line Items
    const lineItemRawRows = readCsvRows(options.inputOrderItems, fields.orderitem);
    const onLineItemStep = tracker ? () => tracker.step(PROGRESS_STAGE.LINEITEMS) : null;
    let lineitems = processLineItems(lineItemRawRows, orderContextByInvNum, schema.lineitem, onLineItemStep);
    if (tracker) tracker.setStageCompleted(PROGRESS_STAGE.LINEITEMS, lineItemRawRows.length, true);
    if (options.maxRows != null) lineitems = lineitems.slice(0, options.maxRows);

    // 7. Assemble ZIP
    const zip = new JSZip();
    addFilesToZip(zip, "processed", "customers", customers, schema.customer, options.splitEvery);
    addFilesToZip(zip, "processed", "vehicles", vehicles, schema.vehicle, options.splitEvery);
    addFilesToZip(zip, "processed", "inventory", inventory, schema.inventory, options.splitEvery);
    addFilesToZip(zip, "processed", "orders", orders, schema.order, options.splitEvery);
    addFilesToZip(zip, "processed", "lineitems", lineitems, schema.lineitem, options.splitEvery);

    // Original sources
    const originalFiles = [
        options.inputCustomers,
        options.inputVehicles,
        options.inputInventory,
        options.inputOrders,
        options.inputOrderItems,
        options.inputCommittedItems,
        options.inputDeposits,
    ].filter((f) => f && fs.existsSync(f));

    for (const filePath of [...new Set(originalFiles)]) {
        const baseName = path.basename(filePath);
        zip.file(`original/${baseName}`, fs.readFileSync(filePath));
    }

    // Instructions
    zip.file("INSTRUCTIONS.md", getMigrationInstructions(targetId));

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const filename = `${targetConfig.filenamePrefix || targetId}.zip`;

    if (tracker) tracker.finish();

    return {
        targetId,
        name: targetConfig.name,
        description: targetConfig.description,
        filename,
        zipBuffer,
        results: {
            customers: customers.length,
            vehicles: vehicles.length,
            inventory: inventory.length,
            orders: orders.length,
            lineItems: lineitems.length,
        },
    };
}

module.exports = {
    runExport,
};
