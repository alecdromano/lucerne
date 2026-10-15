const { parseAmount, parseNumber } = require("./invoice.js");
const { nonEmptyString } = require("../common/util.js");

function analyzeLineItems(lineItemsRaw, mappingConfig) {
    const lineItems = lineItemsRaw.map((item, idx) => {
        const fields = {};
        for (const [label, key] of mappingConfig.lineitems) {
            fields[label] = String(item[key] ?? "");
        }
        return { idx: idx + 1, fields, isCommitted: !!item._COMMITTED };
    });

    const probableDataLoss = lineItems.some((it) => /no\s+problem\s+found/i.test(nonEmptyString(it.fields.Description)));
    let hasLaborLine = false;
    let hasLaborDuration = false;
    let gpRevenueAmount = 0;
    let gpCostAmount = 0;
    let costDataIncomplete = false;

    for (const item of lineItemsRaw) {
        if (item._MISSING_COST) costDataIncomplete = true;
        const make = (nonEmptyString(item.MAKE) || "").toUpperCase();
        const serial = nonEmptyString(item.SERIAL_NUM);
        if (make === "LABOR") {
            hasLaborLine = true;
            if (/;\s*[0-9]+(?:\.[0-9]+)?/.test(serial)) {
                hasLaborDuration = true;
            }
        }
        const qtyRaw = parseNumber(item.QUANTITY);
        const quantity = Number.isFinite(qtyRaw) && qtyRaw !== 0 ? qtyRaw : 1;
        const sub = parseAmount(item.SUBTOTAL);
        const price = parseAmount(item.PRICE);
        const cost = parseAmount(item.COST);
        const isCommittedRow = !!item._COMMITTED;

        const lineRevenue = sub !== 0 ? sub : (price * quantity);
        const lineCost = isCommittedRow ? (cost * quantity) : cost;
        if (Number.isFinite(lineRevenue) && Number.isFinite(lineCost)) {
            gpRevenueAmount += lineRevenue;
            gpCostAmount += lineCost;
        }
    }

    return {
        lineItems,
        probableDataLoss,
        hasLaborLine,
        hasLaborDuration,
        gpRevenueAmount,
        gpCostAmount,
        costDataIncomplete,
    };
}

function buildInventoryCostLookup(inventoryRows) {
    const lookup = new Map();
    for (const row of inventoryRows) {
        const make = (nonEmptyString(row.MAKE) || "").toUpperCase();
        const model = (nonEmptyString(row.MODEL) || "").toUpperCase();
        if (!model) continue;
        const cost = parseAmount(row.COST);
        const avgCost = parseAmount(row.AVG_COST);
        const effectiveCost = cost !== 0 ? cost : avgCost;
        const key = `${make}:${model}`;
        if (!lookup.has(key)) lookup.set(key, effectiveCost);
    }
    return lookup;
}

function enrichCommittedRowCosts(committedRows, costLookup) {
    for (const row of committedRows) {
        row._COMMITTED = true;
        const make = (nonEmptyString(row.MAKE) || "").toUpperCase();
        const model = (nonEmptyString(row.MODEL) || "").toUpperCase();
        const key = `${make}:${model}`;
        if (costLookup && costLookup.has(key)) {
            row.COST = String(costLookup.get(key));
        } else {
            row._MISSING_COST = true;
        }
    }
}

function mergeCommittedItems(itemsByOrder, committedRows) {
    const committedByOrder = new Map();
    for (const row of committedRows) {
        const orderNumber = nonEmptyString(row.INV_NUM);
        if (!orderNumber || itemsByOrder.has(orderNumber)) continue;
        if (!committedByOrder.has(orderNumber)) committedByOrder.set(orderNumber, []);
        committedByOrder.get(orderNumber).push(row);
    }
    for (const [orderNumber, rows] of committedByOrder) {
        itemsByOrder.set(orderNumber, rows);
    }
}

function groupItemsByOrder(orderItemRows) {
    const itemsByOrder = new Map();

    const normalizeSalesperson = (value) => {
        const text = nonEmptyString(value);
        return text === "*" ? "" : text.toUpperCase();
    };

    const itemFingerprint = (item) => [
        nonEmptyString(item.INV_NUM),
        nonEmptyString(item.QUANTITY),
        nonEmptyString(item.MAKE),
        nonEmptyString(item.MODEL),
        nonEmptyString(item.DESCRIPTIO),
        nonEmptyString(item.SERIAL_NUM),
        nonEmptyString(item.COST),
        nonEmptyString(item.PRICE),
        nonEmptyString(item.SUBTOTAL),
    ].join("\u0001");

    const salespersonFingerprint = (item) => `${normalizeSalesperson(item.SALESPRSN)}|${normalizeSalesperson(item.SALESPRSN2)}`;
    const seenByOrder = new Map();

    for (const item of orderItemRows) {
        const orderNumber = nonEmptyString(item.INV_NUM);
        if (!orderNumber) continue;

        const itemKey = itemFingerprint(item);
        const salespersonKey = salespersonFingerprint(item);

        if (!seenByOrder.has(orderNumber)) seenByOrder.set(orderNumber, new Map());
        const seenByItem = seenByOrder.get(orderNumber);

        if (!seenByItem.has(itemKey)) {
            seenByItem.set(itemKey, new Set([salespersonKey]));
        } else {
            const salespersonKeys = seenByItem.get(itemKey);
            if (!salespersonKeys.has(salespersonKey)) {
                // Ignore duplicate rows where only salesperson split differs.
                salespersonKeys.add(salespersonKey);
                continue;
            }
        }

        if (!itemsByOrder.has(orderNumber)) itemsByOrder.set(orderNumber, []);
        itemsByOrder.get(orderNumber).push(item);
    }
    return itemsByOrder;
}

module.exports = {
    analyzeLineItems,
    buildInventoryCostLookup,
    enrichCommittedRowCosts,
    mergeCommittedItems,
    groupItemsByOrder,
};
