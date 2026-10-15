const { formatGeneratedNote } = require("./clean.js");
const { buildOwnerMap } = require("./vehicles.js");
const { formatInventoryMoney } = require("./inventory.js");
const { parseMoneyCents, centsToMoney } = require("../common/money.js");

const STOPGAP_ORDER_COUNT = 100n;
const STOPGAP_ORDER_NOTE = "Migration stopgap, edit if necessary.";

function firstNonEmpty(...values) {
    for (const v of values) {
        const text = String(v ?? "").trim();
        if (text) return text;
    }
    return "";
}

function parseMoneyAmount(raw) {
    return centsToMoney(parseMoneyCents(raw));
}

function resolveJobCustomerReference(row) {
    const fields = ["CUSTOMER_ID", "CUST_UID", "CUST_ID"];
    for (const field of fields) {
        const value = String(row[field] || "").trim();
        if (value) return { field, value };
    }
    return { field: "", value: "" };
}

function findUnidentifiedCustomer(customers) {
    for (const cust of customers || []) {
        const first = String(cust["First Name*"] || "").trim();
        const last = String(cust["Last Name*"] || "").trim();
        if (first === "Unidentified" && last === "Unidentified") {
            return {
                owner: "",
                lucerneId: String(cust["Lucerne ID"] || "").trim(),
                tssIdText: "",
            };
        }
    }
    return null;
}

function appendStopgapOrders(ordersByInvNum, unidentifiedCustomer, processingDateText) {
    if (!ordersByInvNum || !unidentifiedCustomer?.lucerneId) return;

    let maxOrderNumber = null;
    for (const orderNumber of ordersByInvNum.keys()) {
        const value = String(orderNumber || "").trim();
        if (!/^\d+$/.test(value)) continue;
        const numeric = BigInt(value);
        if (maxOrderNumber == null || numeric > maxOrderNumber) {
            maxOrderNumber = numeric;
        }
    }

    if (maxOrderNumber == null) return;

    for (let idx = 1n; idx <= STOPGAP_ORDER_COUNT; idx += 1n) {
        const stopgapOrderNumber = (maxOrderNumber + idx).toString();
        if (ordersByInvNum.has(stopgapOrderNumber)) continue;

        ordersByInvNum.set(stopgapOrderNumber, {
            orderNumber: stopgapOrderNumber,
            sourceCustomerField: "",
            sourceCustomerId: "",
            sourceCustomerName: "Unidentified",
            generatedNote: STOPGAP_ORDER_NOTE,
            salesperson: "",
            matchedTssIds: "",
            lucerneId: unidentifiedCustomer.lucerneId,
            matchedCustomerName: "Unidentified",
            lucerneVehicleId: "",
            orderDate: processingDateText || "",
            orderTotal: "0.00",
            balanceDue: "0.00",
            depositAmount: "0.00",
            notes: "",
        });
    }
}

function buildJobLookup(rows, customerLookup, vehicleIdLookup, unidentifiedCustomer, processingDateText, onProgress = null) {
    const ordersByInvNum = new Map();

    for (const row of rows) {
        if (onProgress) onProgress();
        const orderNumber = String(row.INV_NUM || "").trim();
        if (!orderNumber) continue;
        if (String(row.INV_STATUS || "").trim().toUpperCase() !== "P") continue;

        const customerRef = resolveJobCustomerReference(row);
        const matchedCustomer = customerRef.value ? customerLookup.get(customerRef.value) || unidentifiedCustomer : unidentifiedCustomer;
        const sourceVehicleId = firstNonEmpty(row.VEHICLE_ID, row.NEW_AUTO_ID, row.AUTO_ID, customerRef.value);
        const notes = [row.JOB_DESC, row.JOB_DESC2, row.WORK_DESC, row.WORK_DESC2, row.WORK_DESC3, row.WORK_DESC4, row.WORK_DESC5, row.REFERENCE]
            .map((v) => String(v || "").trim())
            .filter(Boolean)
            .join(" | ");

        ordersByInvNum.set(orderNumber, {
            orderNumber,
            sourceCustomerField: customerRef.field,
            sourceCustomerId: customerRef.value,
            sourceCustomerName: String(row.CUST_NAME || "").trim(),
            salesperson: firstNonEmpty(row.SALESPRSN, row.SALESPRSN2),
            matchedTssIds: matchedCustomer?.tssIdText || "",
            lucerneId: matchedCustomer?.lucerneId || "",
            matchedCustomerName: matchedCustomer?.owner || "",
            lucerneVehicleId: sourceVehicleId ? vehicleIdLookup.get(sourceVehicleId) || "" : "",
            orderDate: String(row.INV_DATE || "").trim(),
            orderTotal: String(row.INV_TOTAL || "").trim(),
            balanceDue: String(row.BAL_DU || "").trim(),
            depositAmount: String(row.DEP_AMT || "").trim(),
            notes,
        });
    }

    appendStopgapOrders(ordersByInvNum, unidentifiedCustomer, processingDateText);
    return ordersByInvNum;
}

function buildOrderAssociationRow(order, columns, options = {}) {
    const row = Object.fromEntries(columns.map((c) => [c, ""]));
    const generatedNotes = [];
    const stopgapGeneratedNote = String(order.generatedNote || "").trim();
    if (stopgapGeneratedNote) {
        generatedNotes.push(stopgapGeneratedNote);
    }
    if (options.prependSalespersonToNotes && order.salesperson) {
        generatedNotes.push(`Original salesperson was ${order.salesperson}.`);
    }

    row["Number*"] = order.orderNumber;
    row["Date"] = order.orderDate;
    if (Object.hasOwn(row, "Salesperson")) {
        row["Salesperson"] = order.salesperson || "";
    }
    row["Total"] = order.orderTotal;
    row["Balance Due"] = order.balanceDue;
    row["Deposit Amount"] = order.depositAmount;
    row["Customer TSS ID(s)"] = order.matchedTssIds;
    row["Customer Lucerne ID"] = order.lucerneId;
    row["Customer Name"] = order.matchedCustomerName || order.sourceCustomerName;
    row["Vehicle Lucerne ID"] = order.lucerneVehicleId;
    row["Notes"] = formatGeneratedNote(generatedNotes.join(" "), order.notes);
    return row;
}

function processOrders(rows, customerRecords, vehicleIdLookup, columns, timestamp = new Date(), onProgress = null) {
    const customerLookup = buildOwnerMap(customerRecords);
    const unidentifiedCustomer = findUnidentifiedCustomer(customerRecords);
    const processingDateText = `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()}`;
    const orderContextByInvNum = buildJobLookup(rows, customerLookup, vehicleIdLookup || new Map(), unidentifiedCustomer, processingDateText, onProgress);

    const orderRows = [];
    for (const order of orderContextByInvNum.values()) {
        orderRows.push(buildOrderAssociationRow(order, columns, { prependSalespersonToNotes: true }));
    }

    return { orderRows, orderContextByInvNum };
}

module.exports = {
    parseMoneyAmount,
    firstNonEmpty,
    processOrders,
};
