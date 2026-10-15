function buildSourceOrderItemRows(transactionRows, onProgress = null) {
    const rowsByItemKey = new Map();
    const outputRows = [];

    const normalizeSalesperson = (value) => {
        const text = String(value || "").trim();
        return text === "*" ? "" : text.toUpperCase();
    };

    for (const row of transactionRows) {
        if (onProgress) onProgress();
        const normalizedRow = {
            INV_NUM: String(row.INV_NUM || "").trim(),
            QUANTITY: String(row.QUANTITY || "").trim(),
            MAKE: String(row.MAKE || "").trim(),
            MODEL: String(row.MODEL || "").trim(),
            DESCRIPTIO: String(row.DESCRIPTIO || "").trim(),
            SERIAL_NUM: String(row.SERIAL_NUM || "").trim(),
            COST: String(row.COST || "").trim(),
            PRICE: String(row.PRICE || "").trim(),
            SUBTOTAL: String(row.SUBTOTAL || "").trim(),
        };

        const itemKey = [
            normalizedRow.INV_NUM,
            normalizedRow.QUANTITY,
            normalizedRow.MAKE,
            normalizedRow.MODEL,
            normalizedRow.DESCRIPTIO,
            normalizedRow.SERIAL_NUM,
            normalizedRow.COST,
            normalizedRow.PRICE,
            normalizedRow.SUBTOTAL,
        ].join("\u0001");
        const salespersonKey = `${normalizeSalesperson(row.SALESPRSN)}|${normalizeSalesperson(row.SALESPRSN2)}`;

        if (!rowsByItemKey.has(itemKey)) {
            rowsByItemKey.set(itemKey, new Set([salespersonKey]));
            outputRows.push(normalizedRow);
            continue;
        }

        const salespersonKeys = rowsByItemKey.get(itemKey);
        if (salespersonKeys.has(salespersonKey)) {
            outputRows.push(normalizedRow);
            continue;
        }

        salespersonKeys.add(salespersonKey);
    }

    return outputRows;
}

function buildOrderLineItemRow(order, lineItem, columns) {
    const row = Object.fromEntries(columns.map((c) => [c, ""]));
    row["Order Number*"] = order?.orderNumber || String(lineItem.INV_NUM || "").trim();
    row["Quantity"] = String(lineItem.QUANTITY || "").trim();
    row["Make"] = String(lineItem.MAKE || "").trim();
    row["Model"] = String(lineItem.MODEL || "").trim();
    row["Description"] = String(lineItem.DESCRIPTIO || "").trim();
    row["Serial Number"] = String(lineItem.SERIAL_NUM || "").trim();
    row["Cost"] = String(lineItem.COST || "").trim();
    row["Price"] = String(lineItem.PRICE || "").trim();
    row["Subtotal"] = String(lineItem.SUBTOTAL || "").trim();
    return row;
}

function processLineItems(rawTransactionRows, orderContextByInvNum, columns, onProgress = null) {
    const dedupedRows = buildSourceOrderItemRows(rawTransactionRows, onProgress);
    const lineItemRows = [];

    for (const row of dedupedRows) {
        const orderNumber = String(row.INV_NUM || "").trim();
        if (orderNumber) {
            const order = orderContextByInvNum.get(orderNumber);
            if (order) {
                lineItemRows.push(buildOrderLineItemRow(order, row, columns));
            }
        }
    }

    return lineItemRows;
}

module.exports = {
    buildSourceOrderItemRows,
    buildOrderLineItemRow,
    processLineItems,
};
