const { parseAmount, normalizeToIsoDate, daysBetween, formatInvoiceStatus, pickCustomerAddressLines } = require("./invoice.js");
const { buildPaymentMethodTotals, normalizePaymentType, normalizePaymentMethod, normalizePaymentReference } = require("./payment.js");
const { analyzeLineItems } = require("./items.js");
const { nonEmptyString } = require("../common/util.js");
const { addMoney, subtractMoney, formatMoney } = require("../common/money.js");

function selectMappedPairs(row, mapping, includeEmptyFields) {
    const pairs = [];
    for (const [label, key] of mapping) {
        const val = String(row[key] ?? "");
        if (!includeEmptyFields && !nonEmptyString(val)) continue;
        pairs.push([label, val]);
    }
    return pairs;
}

function computeInvoiceSubtotal(order, totalAmount) {
    const rawSubtotal = nonEmptyString(order && order.INV_SUBTOTAL);
    if (rawSubtotal) {
        return {
            subtotal: rawSubtotal,
            subtotalAmount: parseAmount(rawSubtotal),
            isDerived: false,
        };
    }

    const materialAmount = parseAmount(order && order.MAT_TOTAL);
    const laborAmount = parseAmount(order && order.TOTAL_LABO);
    const subletAmount = parseAmount(order && order.SUB_PRICE);
    const otherAmount = parseAmount(order && order.OTHER_SUB);
    const miscAmount = parseAmount(order && order.MISC_SUB);
    const taxAmount = parseAmount(order && order.TOTAL_TAX);

    const componentKeys = ["MAT_TOTAL", "TOTAL_LABO", "SUB_PRICE", "OTHER_SUB"];
    const hasIncludedComponents = componentKeys.some(function(key) {
        return Boolean(nonEmptyString(order && order[key]));
    });

    let subtotalAmount = 0;
    if (hasIncludedComponents) {
        subtotalAmount = addMoney(materialAmount, laborAmount, subletAmount, otherAmount);
    } else {
        const deducted = addMoney(miscAmount, taxAmount);
        subtotalAmount = subtractMoney(totalAmount, deducted);
    }
    return {
        subtotal: formatMoney(subtotalAmount),
        subtotalAmount,
        isDerived: true,
    };
}

function groupPaymentsByOrder(paymentRows) {
    const map = new Map();
    for (const row of paymentRows) {
        const orderNumber = nonEmptyString(row.INV_NUM);
        if (!orderNumber) continue;
        const tx = {
            type: normalizePaymentType(row.TYPE_TRANS),
            amount: parseAmount(row.AMOUNT),
            transactionDate: nonEmptyString(row.TRANS_DATE),
            transactionDateIso: normalizeToIsoDate(row.TRANS_DATE),
            transactionTime: nonEmptyString(row.TIME) || nonEmptyString(row.LAST_TIME),
            method: normalizePaymentMethod(row),
            reference: normalizePaymentReference(row.CHECK_NUM, row.AUTH_CODE, row.CARD_TRANS),
            notes: [row.NOTES, row.NOTES2, row.NOTES3, row.NOTES_MEMO]
                .map((v) => nonEmptyString(v))
                .filter(Boolean)
                .join(" | "),
        };
        if (!map.has(orderNumber)) map.set(orderNumber, []);
        map.get(orderNumber).push(tx);
    }

    for (const transactions of map.values()) {
        transactions.sort((left, right) => {
            const cmp = String(left.transactionDateIso || "").localeCompare(String(right.transactionDateIso || ""));
            if (cmp !== 0) return cmp;
            return String(left.transactionTime || "").localeCompare(String(right.transactionTime || ""));
        });
    }

    return map;
}

function buildOrdersPayload(orders, itemsByOrder, paymentsByOrder, mappingConfig, includeEmptyFields = false) {
    const renderable = [];

    for (let i = 0; i < orders.length; i += 1) {
        const order = orders[i];
        const orderNumber = nonEmptyString(order.INV_NUM);
        const invoiceDate = nonEmptyString(order.INV_DATE);
        const invoiceDateIso = normalizeToIsoDate(invoiceDate);
        const createdDate = nonEmptyString(order.DATE_CREAT);
        const createdDateIso = normalizeToIsoDate(createdDate);
        const transactionDate = nonEmptyString(order.TRANS_DATE);
        const lastActivityDate = nonEmptyString(order.LAST_DATE);
        const lastActivityDateIso = normalizeToIsoDate(lastActivityDate);
        const lastActivityTime = nonEmptyString(order.LAST_TIME);
        const salesperson = nonEmptyString(order.SALESPRSN) || nonEmptyString(order.SALESPRSN2);
        const customerName = nonEmptyString(order.CUST_NAME);
        const status = nonEmptyString(order.INV_STATUS);
        const statusCode = (status || "").toUpperCase();

        const total = nonEmptyString(order.INV_TOTAL);
        const totalAmount = parseAmount(total);
        const subtotalInfo = computeInvoiceSubtotal(order, totalAmount);
        const subtotal = subtotalInfo.subtotal;
        const subtotalAmount = subtotalInfo.subtotalAmount;
        const balanceDue = nonEmptyString(order.BAL_DU);
        const balanceDueAmount = parseAmount(balanceDue);
        const deposit = nonEmptyString(order.DEP_AMT);
        const depositAmount = parseAmount(deposit);
        const paidAmount = addMoney(order.PAID_CASH, order.PAID_CHECK, order.PAID_CHARG, order.PAID_OPEN, order.PAID_HOUSE);

        const paymentTransactions = paymentsByOrder.get(orderNumber) || [];
        const firstPaymentDateIso = paymentTransactions.length > 0 ? paymentTransactions[0].transactionDateIso : null;
        const lastPaymentDateIso = paymentTransactions.length > 0 ? paymentTransactions[paymentTransactions.length - 1].transactionDateIso : null;

        const deltaCreateToInvoice = daysBetween(createdDateIso, invoiceDateIso);
        const deltaCreateToModified = daysBetween(createdDateIso, lastActivityDateIso);
        const deltaCreateToFirstPaid = daysBetween(createdDateIso, firstPaymentDateIso);
        const deltaCreateToPaid = daysBetween(createdDateIso, lastPaymentDateIso);
        const deltaInvoiceToModified = daysBetween(invoiceDateIso, lastActivityDateIso);
        const deltaInvoiceToFirstPaid = daysBetween(invoiceDateIso, firstPaymentDateIso);
        const deltaInvoiceToPaid = daysBetween(invoiceDateIso, lastPaymentDateIso);
        const deltaModifiedToFirstPaid = daysBetween(lastActivityDateIso, firstPaymentDateIso);
        const deltaModifiedToPaid = daysBetween(lastActivityDateIso, lastPaymentDateIso);
        const deltaFirstPaidToPaid = daysBetween(firstPaymentDateIso, lastPaymentDateIso);

        const paymentMethodTotals = buildPaymentMethodTotals(order, paymentTransactions);
        const collectedAmount = addMoney(...paymentMethodTotals.map((entry) => entry.amount));

        const lineItemsRaw = itemsByOrder.get(orderNumber) || [];
        const itemAnalysis = analyzeLineItems(lineItemsRaw, mappingConfig);
        const lineItems = itemAnalysis.lineItems;

        const effectiveRevenueAmount = itemAnalysis.gpRevenueAmount !== 0 ? itemAnalysis.gpRevenueAmount : subtotalAmount;
        const grossProfitAmount = subtractMoney(effectiveRevenueAmount, itemAnalysis.gpCostAmount);
        const grossProfitPercent = effectiveRevenueAmount > 0
            ? Number(((grossProfitAmount / effectiveRevenueAmount) * 100).toFixed(1))
            : null;

        const invoiceMetaSource = {
            ...order,
            _DATA_INTEGRITY: itemAnalysis.probableDataLoss ? "❗️ Probable data loss" : "Normal",
            _STATUS_LABEL: formatInvoiceStatus(statusCode),
            _INVOICE_DATE: invoiceDate,
            _CREATED_DATE: createdDate,
            _TRANSACTION_DATE: transactionDate,
        };

        const serviceNotes = (mappingConfig.notes || []).map((k) => nonEmptyString(order[k])).filter(Boolean);
        const invoiceMeta = selectMappedPairs(invoiceMetaSource, mappingConfig.meta, includeEmptyFields);
        const customerDetail = selectMappedPairs(order, mappingConfig.customer, includeEmptyFields);
        const vehicleDetail = selectMappedPairs(order, mappingConfig.vehicle, includeEmptyFields);
        const totals = selectMappedPairs(order, mappingConfig.totals, includeEmptyFields);
        const customerAddress = pickCustomerAddressLines(order, nonEmptyString);

        const searchText = [
            orderNumber, invoiceDate, createdDate, salesperson, customerName, status, total, balanceDue, deposit,
            ...invoiceMeta.flatMap((p) => [p[0], p[1]]),
            ...customerDetail.flatMap((p) => [p[0], p[1]]),
            ...vehicleDetail.flatMap((p) => [p[0], p[1]]),
            ...totals.flatMap((p) => [p[0], p[1]]),
            ...serviceNotes,
            ...lineItems.flatMap((it) => Object.values(it.fields)),
        ].join(" ").toLowerCase();

        renderable.push({
            orderNumber,
            invoiceDate,
            invoiceDateIso,
            createdDate,
            createdDateIso,
            transactionDate,
            lastActivityDate,
            lastActivityDateIso,
            lastActivityTime,
            salesperson,
            customerName,
            status,
            statusCode,
            subtotal,
            subtotalAmount,
            subtotalDerived: subtotalInfo.isDerived,
            total,
            totalAmount,
            balanceDue,
            balanceDueAmount,
            deposit,
            depositAmount,
            paidAmount,
            collectedAmount,
            paymentMethodTotals,
            paymentTransactions,
            invoiceMeta,
            customerDetail,
            customerAddress,
            vehicleDetail,
            serviceNotes,
            totals,
            lineItems,
            probableDataLoss: itemAnalysis.probableDataLoss,
            hasLaborLine: itemAnalysis.hasLaborLine,
            hasLaborDuration: itemAnalysis.hasLaborDuration,
            netRevenueAmount: effectiveRevenueAmount,
            grossProfitAmount,
            grossProfitPercent,
            grossProfitRevenueAmount: effectiveRevenueAmount,
            grossProfitCostAmount: itemAnalysis.gpCostAmount,
            costDataIncomplete: itemAnalysis.costDataIncomplete,
            searchText,
            deltaCreateToInvoice,
            deltaCreateToModified,
            deltaCreateToFirstPaid,
            deltaCreateToPaid,
            deltaInvoiceToModified,
            deltaInvoiceToFirstPaid,
            deltaInvoiceToPaid,
            deltaModifiedToFirstPaid,
            deltaModifiedToPaid,
            deltaFirstPaidToPaid,
        });
    }

    return renderable;
}

module.exports = {
    computeInvoiceSubtotal,
    groupPaymentsByOrder,
    buildOrdersPayload,
};
