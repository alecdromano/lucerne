const { parseAmount } = require("./invoice.js");
const { nonEmptyString } = require("../common/util.js");

function normalizePaymentType(value) {
    const raw = (nonEmptyString(value) || "").toUpperCase();
    if (!raw) return "Other";
    if (raw === "DEPOSIT") return "Deposit";
    if (raw === "PAYMENT") return "Payment";
    return raw.charAt(0) + raw.slice(1).toLowerCase();
}

function normalizePaymentMethod(row) {
    const howPaid = (nonEmptyString(row.HOW_PAID) || "").toUpperCase();
    const cardType = nonEmptyString(row.CARD_TYPE);
    if (howPaid === "CHRG") return cardType ? `Card (${cardType})` : "Card";
    if (howPaid === "CHECK") return "Check";
    if (howPaid === "CASH") return "Cash";
    if (howPaid === "OPEN") return "Open";
    if (howPaid === "HOUSE") return "House";
    return nonEmptyString(row.HOW_PAID) || "Unknown";
}

function normalizePaymentReference(...values) {
    for (const v of values) {
        const text = nonEmptyString(v);
        if (!text) continue;
        if (text.toUpperCase() === "N") continue;
        return text;
    }
    return "";
}

function getPaymentRowFingerprint(row) {
    const safeRow = row || {};
    return [
        nonEmptyString(safeRow.INV_NUM).toUpperCase(),
        nonEmptyString(safeRow.TYPE_TRANS).toUpperCase(),
        nonEmptyString(safeRow.TRANS_DATE).toUpperCase(),
        nonEmptyString(safeRow.TIME).toUpperCase(),
        nonEmptyString(safeRow.HOW_PAID).toUpperCase(),
        nonEmptyString(safeRow.AMOUNT).toUpperCase(),
        nonEmptyString(safeRow.CHECK_NUM).toUpperCase(),
        nonEmptyString(safeRow.AUTH_CODE).toUpperCase(),
        nonEmptyString(safeRow.CARD_TRANS).toUpperCase(),
        nonEmptyString(safeRow.CUST_NAME).toUpperCase(),
    ].join("|");
}

function mergePaymentRows(primaryRows, secondaryRows) {
    const merged = [];
    const seenFingerprints = new Set();

    for (let i = 0; i < primaryRows.length; i += 1) {
        const row = primaryRows[i];
        const fingerprint = getPaymentRowFingerprint(row);
        seenFingerprints.add(fingerprint);
        merged.push(row);
    }

    for (let i = 0; i < secondaryRows.length; i += 1) {
        const row = secondaryRows[i];
        const fingerprint = getPaymentRowFingerprint(row);
        if (seenFingerprints.has(fingerprint)) continue;
        seenFingerprints.add(fingerprint);
        merged.push(row);
    }

    return merged;
}

function buildPaymentMethodTotals(order, paymentTransactions) {
    const totalsByMethod = new Map();

    const add = (method, amount) => {
        const normalizedMethod = nonEmptyString(method) || "Unknown";
        if (!Number.isFinite(amount) || amount === 0) return;
        totalsByMethod.set(normalizedMethod, Number(((totalsByMethod.get(normalizedMethod) || 0) + amount).toFixed(2)));
    };

    if (Array.isArray(paymentTransactions) && paymentTransactions.length) {
        for (let i = 0; i < paymentTransactions.length; i += 1) {
            const transaction = paymentTransactions[i] || {};
            add(transaction.method, parseAmount(transaction.amount));
        }
    } else {
        add("Cash", parseAmount(order && order.PAID_CASH));
        add("Check", parseAmount(order && order.PAID_CHECK));
        add(nonEmptyString(order && order.CARD_TYPE) ? `Card (${nonEmptyString(order.CARD_TYPE)})` : "Card", parseAmount(order && order.PAID_CHARG));
        add("Open", parseAmount(order && order.PAID_OPEN));
        add("House", parseAmount(order && order.PAID_HOUSE));

        const depositAmount = parseAmount(order && order.DEP_AMT);
        if (depositAmount !== 0) {
            add(normalizePaymentMethod({ HOW_PAID: order && order.DEP_TYPE, CARD_TYPE: order && order.CARD_TYPE }), depositAmount);
        }
    }

    const methodOrder = ["Cash", "Check", "Card", "Open", "House", "Unknown"];
    return Array.from(totalsByMethod.entries())
        .map(function(entry) {
            const method = entry[0];
            return {
                method,
                label: method === "Unknown" ? "Paid" : ("Paid " + method),
                amount: entry[1],
            };
        })
        .sort(function(left, right) {
            const leftIdx = methodOrder.findIndex(function(prefix) { return left.method === prefix || left.method.startsWith(prefix + " ") || left.method.startsWith(prefix + "("); });
            const rightIdx = methodOrder.findIndex(function(prefix) { return right.method === prefix || right.method.startsWith(prefix + " ") || right.method.startsWith(prefix + "("); });
            const safeLeftIdx = leftIdx === -1 ? methodOrder.length : leftIdx;
            const safeRightIdx = rightIdx === -1 ? methodOrder.length : rightIdx;
            if (safeLeftIdx !== safeRightIdx) return safeLeftIdx - safeRightIdx;
            return left.method.localeCompare(right.method);
        });
}

module.exports = {
    normalizePaymentType,
    normalizePaymentMethod,
    normalizePaymentReference,
    mergePaymentRows,
    buildPaymentMethodTotals,
};
