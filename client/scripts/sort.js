function compareTextAsc(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base" });
}

function compareInvoiceAsc(leftOrder, rightOrder) {
    const leftRaw = String(leftOrder.orderNumber || "");
    const rightRaw = String(rightOrder.orderNumber || "");
    const leftNum = Number.parseInt(leftRaw.replace(/\D/g, ""), 10);
    const rightNum = Number.parseInt(rightRaw.replace(/\D/g, ""), 10);

    if (Number.isFinite(leftNum) && Number.isFinite(rightNum) && leftNum !== rightNum) {
        return leftNum - rightNum;
    }
    return compareTextAsc(leftRaw, rightRaw);
}

function compareInvoiceDateAsc(leftOrder, rightOrder) {
    const leftDate = String(leftOrder.invoiceDateIso || "");
    const rightDate = String(rightOrder.invoiceDateIso || "");
    return compareTextAsc(leftDate, rightDate) || compareInvoiceAsc(leftOrder, rightOrder);
}

function compareCreatedDateAsc(leftOrder, rightOrder) {
    const leftDate = String(leftOrder.createdDateIso || "");
    const rightDate = String(rightOrder.createdDateIso || "");
    return compareTextAsc(leftDate, rightDate) || compareInvoiceAsc(leftOrder, rightOrder);
}

function compareCustomerAsc(leftOrder, rightOrder) {
    const customerCmp = compareTextAsc(leftOrder.customerName, rightOrder.customerName);
    if (customerCmp !== 0) return customerCmp;
    return compareInvoiceAsc(leftOrder, rightOrder);
}

function compareBalanceDueAsc(leftOrder, rightOrder) {
    const leftBalance = Number(leftOrder.balanceDueAmount || 0);
    const rightBalance = Number(rightOrder.balanceDueAmount || 0);
    if (leftBalance !== rightBalance) {
        return leftBalance - rightBalance;
    }
    return compareInvoiceAsc(leftOrder, rightOrder);
}

function compareInvoiceTotalAsc(leftOrder, rightOrder) {
    const leftTotal = Number(leftOrder.totalAmount || 0);
    const rightTotal = Number(rightOrder.totalAmount || 0);
    if (leftTotal !== rightTotal) {
        return leftTotal - rightTotal;
    }
    return compareInvoiceAsc(leftOrder, rightOrder);
}

function applySort() {
    const sortKey = String((sortBy && sortBy.value) || "invoiceDate");
    const direction = String((sortDir && sortDir.value) || "desc");
    matchedIndices.sort(function(leftIdx, rightIdx) {
        const leftOrder = orders[leftIdx] || {};
        const rightOrder = orders[rightIdx] || {};
        let comparison;

        if (sortKey === "invoiceDate") comparison = compareInvoiceDateAsc(leftOrder, rightOrder);
        else if (sortKey === "createdDate") comparison = compareCreatedDateAsc(leftOrder, rightOrder);
        else if (sortKey === "customer") comparison = compareCustomerAsc(leftOrder, rightOrder);
        else if (sortKey === "balanceDue") comparison = compareBalanceDueAsc(leftOrder, rightOrder);
        else if (sortKey === "invoiceTotal") comparison = compareInvoiceTotalAsc(leftOrder, rightOrder);
        else comparison = compareInvoiceAsc(leftOrder, rightOrder);

        return direction === "desc" ? -comparison : comparison;
    });
}



