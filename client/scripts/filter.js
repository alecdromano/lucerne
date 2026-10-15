function getActiveDateRange() {
    const rawFrom = (filterDateFrom.value || "").trim();
    const rawTo = (filterDateTo.value || "").trim();
    let rangeStart = rawFrom;
    let rangeEnd = rawTo;
    if (rangeStart && rangeEnd && rangeStart > rangeEnd) {
        const swap = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = swap;
    }
    return {
        rangeStart,
        rangeEnd,
        hasDateRange: !!(rangeStart || rangeEnd),
    };
}

function collectMatchedIndices(options) {
    const opts = options || {};
    const activeDateRange = getActiveDateRange();
    const q = (search.value || "").trim().toLowerCase();
    const deltaPairRequirements = deltaPairMap.map(function(pair) {
        const el = deltaPairTextEls[pair.textId];
        let gap = el ? parseInt(el.value, 10) : 0;
        if (!Number.isFinite(gap) || gap < 0) gap = 0;
        return { orderKey: pair.orderKey, min: gap };
    });

    const matched = [];

    if (!includePosted && !includeUnposted && !includeVoided && !includeBlankStatus) {
        return matched;
    }

    for (let i = 0; i < orders.length; i += 1) {
        const order = orders[i] || {};
        const orderNumber = getOrderNumber(order);
        const salespersonKey = normalizeSalespersonKey(order.salesperson);
        const text = String(order.searchText || "");
        const statusCode = String(order.statusCode || "").toUpperCase();
        const hasLaborLine = !!order.hasLaborLine;
        const hasLaborDuration = !!order.hasLaborDuration;
        const balanceDueAmount = Number(order.balanceDueAmount || 0);
        const depositAmount = Number(order.depositAmount || 0);
        const totalAmount = Number(order.totalAmount || 0);
        const paymentAmount = getOrderCollectedAmount(order);

        let dateOk = true;
        if (opts.includeDateRange && activeDateRange.hasDateRange) {
            const date = String(order.createdDateIso || "");
            if (activeDateRange.rangeStart && date < activeDateRange.rangeStart) dateOk = false;
            if (activeDateRange.rangeEnd && date > activeDateRange.rangeEnd) dateOk = false;
        }

        const textOk = !q || text.indexOf(q) !== -1;
        const statusOk = (statusCode === "P" && includePosted)
            || (statusCode === "S" && includeUnposted)
            || (statusCode === "V" && includeVoided)
            || (!statusCode && includeBlankStatus)
            || (statusCode !== "P" && statusCode !== "S" && statusCode !== "V" && includeBlankStatus);
        const paymentsOk = !requirePayments || paymentAmount > 0;
        const depositOk = !requireDeposit || depositAmount > 0;
        const balanceDueOk = !requireBalanceDue || balanceDueAmount > 0;
        const paidRatio = totalAmount > 0 ? (paymentAmount / totalAmount) : 0;
        const isFullyPaid = totalAmount > 0 && paymentAmount > 0 && balanceDueAmount <= 0;
        const isMostlyPaid = isFullyPaid || (totalAmount > 0 && paidRatio >= 0.95);
        let paidStatusOk = true;
        if (requireFullyPaid && requireMostlyPaid) {
            paidStatusOk = isFullyPaid || isMostlyPaid;
        } else if (requireFullyPaid) {
            paidStatusOk = isFullyPaid;
        } else if (requireMostlyPaid) {
            paidStatusOk = isMostlyPaid;
        }
        const salespersonOk = !selectedSalespeople.size || selectedSalespeople.has(salespersonKey);
        const markedOk = !requireMarked || markedInvoiceNumbers.has(orderNumber);
        const laborOk = !requireLabor || hasLaborLine;
        const laborDurationOk = !requireLaborDuration || hasLaborDuration;
        let customTagOk = true;
        if (selectedCustomTags.size) {
            customTagOk = false;
            const tags = getOrderTags(orderNumber);
            for (const tag of tags) {
                if (selectedCustomTags.has(normalizeTagKey(tag))) {
                    customTagOk = true;
                    break;
                }
            }
        }

        let deltaOk = true;
        for (let d = 0; d < deltaPairRequirements.length; d += 1) {
            const req = deltaPairRequirements[d];
            if (req.min <= 0) continue;
            const val = order[req.orderKey];
            if (val === null || val === undefined || val < req.min) {
                deltaOk = false;
                break;
            }
        }

        if (dateOk && textOk && statusOk && paymentsOk && depositOk && balanceDueOk && paidStatusOk && salespersonOk && markedOk && laborOk && laborDurationOk && customTagOk && deltaOk) {
            matched.push(i);
        }
    }

    return matched;
}

function applyFilterNow(preserveScrollPosition) {
    saveUiState();
    matchedIndices = collectMatchedIndices({ includeDateRange: true });
    if (!matchedIndices.length && !includePosted && !includeUnposted && !includeVoided && !includeBlankStatus) {
        renderTrendCards();
        if (activeTrendRenderer) activeTrendRenderer();
        applySort();
        renderPage(!!preserveScrollPosition);
        return;
    }
    renderTrendCards();
    if (activeTrendRenderer) activeTrendRenderer();
    applySort();
    renderPage(!!preserveScrollPosition);
}

function applyFilter(preserveScrollPosition) {
    const token = ++pendingFilterToken;
    setAppBusy(true);
    window.requestAnimationFrame(function() {
        if (token !== pendingFilterToken) return;
        window.requestAnimationFrame(function() {
            if (token !== pendingFilterToken) return;
            try {
                applyFilterNow(preserveScrollPosition);
            } finally {
                window.requestAnimationFrame(function() {
                    if (token === pendingFilterToken) setAppBusy(false);
                });
            }
        });
    });
}

function maybeLoadMore() {
    if (renderedCount >= matchedIndices.length) return;
    var triggerPoint = ordersPane.scrollTop + ordersPane.clientHeight;
    var threshold = ordersPane.scrollHeight - 300;
    if (triggerPoint >= threshold) {
        renderNextPage(false, false);
    }
}

