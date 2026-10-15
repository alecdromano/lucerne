const { formatMoney } = require("../common/money.js");

function normalizeInventoryText(raw) {
    return String(raw || "").trim().replace(/\s+/g, " ");
}

function normalizeInventoryKey(raw) {
    return normalizeInventoryText(raw).toLowerCase().replace(/\s+/g, " ");
}

function parseInventoryDecimal(raw, minValue = null) {
    const cleaned = normalizeInventoryText(raw).replace(/,/g, "").replace(/\$/g, "");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return null;
    if (minValue != null && parsed < minValue) return null;
    return parsed;
}

function formatInventoryMoney(value) {
    return formatMoney(value);
}

function formatInventoryQuantity(value) {
    if (value == null) return "";
    const text = String(value);
    if (text.includes(".")) return text.replace(/0+$/, "").replace(/\.$/, "");
    return text;
}

function inventoryDedupeKey(row) {
    return normalizeInventoryKey(row["Name*"] || "");
}

function mergeScalar(existing, incoming, favorLonger = false) {
    if (!existing) return incoming;
    if (!incoming) return existing;
    if (existing === incoming) return existing;
    if (favorLonger) return incoming.length > existing.length ? incoming : existing;
    return existing;
}

function mergeInventoryRows(existing, incoming) {
    const merged = { ...existing };
    merged["Name*"] = mergeScalar(existing["Name*"], incoming["Name*"]);
    merged["Part # (optional)"] = mergeScalar(existing["Part # (optional)"], incoming["Part # (optional)"]);
    merged["Note (optional)"] = mergeScalar(existing["Note (optional)"], incoming["Note (optional)"], true);
    merged["Brand (optional)"] = mergeScalar(existing["Brand (optional)"], incoming["Brand (optional)"], true);
    merged["Category (optional)"] = mergeScalar(existing["Category (optional)"], incoming["Category (optional)"], true);
    merged["Sub-Category (optional)"] = mergeScalar(existing["Sub-Category (optional)"], incoming["Sub-Category (optional)"], true);
    merged["Should this be taxed? (optional)"] = mergeScalar(existing["Should this be taxed? (optional)"], incoming["Should this be taxed? (optional)"]);

    const maxOr = (a, b) => {
        if (a == null) return b;
        if (b == null) return a;
        return Math.max(a, b);
    };

    merged["Cost (optional)"] = formatInventoryMoney(maxOr(parseInventoryDecimal(existing["Cost (optional)"], 0), parseInventoryDecimal(incoming["Cost (optional)"], 0)));
    merged["Retail (optional)"] = formatInventoryMoney(maxOr(parseInventoryDecimal(existing["Retail (optional)"], 0), parseInventoryDecimal(incoming["Retail (optional)"], 0)));
    merged["On Hand Quantity (optional)"] = formatInventoryQuantity(maxOr(parseInventoryDecimal(existing["On Hand Quantity (optional)"], 0), parseInventoryDecimal(incoming["On Hand Quantity (optional)"], 0)));

    return merged;
}

function buildInventoryRow(sourceRow, columns) {
    const inventory = Object.fromEntries(columns.map((c) => [c, ""]));
    const model = normalizeInventoryText(sourceRow.MODEL);
    const description = normalizeInventoryText(sourceRow.DESCRIPTIO);
    const cost = parseInventoryDecimal(sourceRow.COST, 0);
    const retail = parseInventoryDecimal(sourceRow.RETAIL, 0);
    const onHand = parseInventoryDecimal(sourceRow.ON_HAND, 0);

    const taxableRaw = normalizeInventoryText(sourceRow.TAXABLE).toLowerCase();
    let taxableValue = "";
    if (["true", "1", "yes", "y"].includes(taxableRaw)) taxableValue = "TRUE";
    else if (["false", "0", "no", "n"].includes(taxableRaw)) taxableValue = "FALSE";

    inventory["Name*"] = description;
    inventory["Note (optional)"] = "";
    inventory["Part # (optional)"] = model;
    inventory["Cost (optional)"] = formatInventoryMoney(cost);
    inventory["Retail (optional)"] = formatInventoryMoney(retail);
    inventory["Brand (optional)"] = normalizeInventoryText(sourceRow.MAKE);
    inventory["Category (optional)"] = normalizeInventoryText(sourceRow.CATEGORY);
    inventory["Sub-Category (optional)"] = normalizeInventoryText(sourceRow.CLASS);
    inventory["On Hand Quantity (optional)"] = formatInventoryQuantity(onHand);
    inventory["Should this be taxed? (optional)"] = taxableValue;
    inventory["Display Part # on estimate & invoice (optional)"] = "TRUE";
    inventory["Display price and quantity on estimate & invoice (optional)"] = "TRUE";

    return inventory;
}

function processInventory(rows, columns, onProgress = null) {
    const recordsByKey = new Map();
    for (const row of rows) {
        if (onProgress) onProgress();
        const item = buildInventoryRow(row, columns);
        if (item["Name*"]) {
            const key = inventoryDedupeKey(item);
            if (recordsByKey.has(key)) {
                recordsByKey.set(key, mergeInventoryRows(recordsByKey.get(key), item));
            } else {
                recordsByKey.set(key, item);
            }
        }
    }
    return [...recordsByKey.values()];
}

module.exports = {
    formatInventoryMoney,
    formatInventoryQuantity,
    processInventory,
};
