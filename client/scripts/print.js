function renderInvoicePrintTablesOnly(order) {
    const card = createEl("section", "invoice invoice-print-only");
    const orderNumber = getOrderNumber(order);
    if (orderNumber) card.dataset.orderNumber = orderNumber;

    const title = createEl("h2", "invoice-title", "ORDER " + (order.orderNumber || "(missing #)"));
    card.appendChild(title);

    const customerDetailPairs = Array.isArray(order.customerDetail) ? order.customerDetail : [];
    if (customerDetailPairs.length) {
        const customerBlock = createEl("div", "block block-spaced");
        customerBlock.appendChild(createEl("h3", "", "Customer"));
        customerBlock.appendChild(renderPairsTable(customerDetailPairs));
        card.appendChild(customerBlock);
    }

    const vehiclePairs = Array.isArray(order.vehicleDetail) ? order.vehicleDetail : [];
    if (vehiclePairs.length) {
        const vehicleBlock = createEl("div", "block block-spaced");
        vehicleBlock.appendChild(createEl("h3", "", "Vehicle"));
        vehicleBlock.appendChild(renderPairsTable(vehiclePairs));
        card.appendChild(vehicleBlock);
    }

    const orderDetailPairs = Array.isArray(order.invoiceMeta) ? order.invoiceMeta : [];
    if (orderDetailPairs.length) {
        const detailBlock = createEl("div", "block block-spaced");
        detailBlock.appendChild(createEl("h3", "", "Order Details"));
        detailBlock.appendChild(renderPairsTable(orderDetailPairs));
        card.appendChild(detailBlock);
    }

    const totalsPairs = buildFinancialPairs(order);
    if (totalsPairs.length) {
        const totalsBlock = createEl("div", "block block-spaced");
        totalsBlock.appendChild(createEl("h3", "", "Financials"));
        totalsBlock.appendChild(renderPairsTable(totalsPairs));
        card.appendChild(totalsBlock);
    }

    const payments = createEl("div", "block block-spaced");
    payments.appendChild(createEl("h3", "", "Transactions"));
    payments.appendChild(renderPaymentTransactionsTable(order.paymentTransactions || []));
    card.appendChild(payments);

    const items = Array.isArray(order.lineItems) ? order.lineItems : [];
    if (items.length) {
        const itemsBlock = createEl("div", "block block-spaced");
        itemsBlock.appendChild(createEl("h3", "", "Line Items"));
        itemsBlock.appendChild(renderLineItemsTable(items));
        card.appendChild(itemsBlock);
    }

    return card;
}

function updateCount() {
    var totalMatches = matchedIndices.length;
    renderOverviewCharts();

    if (!totalMatches) {
        loadMore.textContent = "No orders matched the current filters";
    } else if (renderedCount < totalMatches) {
        loadMore.textContent = "Scroll to load more orders";
    } else {
        loadMore.textContent = "All matched orders loaded";
    }
}

function renderNextPage(reset, force) {
    if (isRenderingChunk) return;

    var totalMatches = matchedIndices.length;
    if (reset) {
        destroyInvoiceCharts();
        renderedCount = 0;
        container.replaceChildren();
    }

    if (renderedCount >= totalMatches) {
        updateCount();
        return;
    }

    const now = Date.now();
    if (!force && now - lastChunkLoadAt < CHUNK_LOAD_COOLDOWN_MS) {
        return;
    }
    lastChunkLoadAt = now;
    isRenderingChunk = true;

    try {
        var nextEnd = Math.min(renderedCount + PAGE_SIZE, totalMatches);
        const fragment = document.createDocumentFragment();
        for (var i = renderedCount; i < nextEnd; i += 1) {
            fragment.appendChild(renderInvoice(orders[matchedIndices[i]]));
        }
        container.appendChild(fragment);
        renderedCount = nextEnd;
        updateCount();
    } finally {
        isRenderingChunk = false;
    }
}

function renderOrdersToCount(targetCount, preserveScrollPosition) {
    const keepScroll = !!preserveScrollPosition;
    const previousScrollTop = ordersPane.scrollTop;
    const desiredCount = Math.max(0, Math.min(Number(targetCount) || 0, matchedIndices.length));

    if (!keepScroll) {
        ordersPane.scrollTop = 0;
    }

    renderedCount = 0;
    container.replaceChildren();
    lastChunkLoadAt = 0;

    if (!matchedIndices.length) {
        renderEmptyState();
        updateCount();
        if (keepScroll) {
            ordersPane.scrollTop = Math.min(previousScrollTop, Math.max(0, ordersPane.scrollHeight - ordersPane.clientHeight));
        }
        return;
    }

    while (renderedCount < desiredCount) {
        renderNextPage(renderedCount === 0, true);
    }

    if (keepScroll) {
        ordersPane.scrollTop = Math.min(previousScrollTop, Math.max(0, ordersPane.scrollHeight - ordersPane.clientHeight));
    }
}

function renderPage(preserveScrollPosition) {
    renderOrdersToCount(PAGE_SIZE, preserveScrollPosition);
}

function appendPrintLimitNotice(renderedForPrint, totalMatched) {
    const notice = createEl("section", "print-limit-notice");
    notice.appendChild(createEl(
        "div",
        "",
        "Print preview limited to " + renderedForPrint.toLocaleString() + " orders (of " + totalMatched.toLocaleString() + " currently filtered) to avoid browser freezing."
    ));
    container.prepend(notice);
}

function preparePrintView() {
    if (printRestoreState) return;
    printRestoreState = {
        renderedCount,
        scrollTop: ordersPane.scrollTop,
    };
    printRenderTablesOnly = true;
    const renderForPrintCount = Math.min(matchedIndices.length, PRINT_MAX_ORDERS);
    renderOrdersToCount(renderForPrintCount, false);
    if (matchedIndices.length > renderForPrintCount) {
        appendPrintLimitNotice(renderForPrintCount, matchedIndices.length);
    }
}

function restoreAfterPrint() {
    if (!printRestoreState) return;
    const state = printRestoreState;
    printRestoreState = null;
    printRenderTablesOnly = false;
    renderOrdersToCount(state.renderedCount, false);
    ordersPane.scrollTop = Math.min(state.scrollTop, Math.max(0, ordersPane.scrollHeight - ordersPane.clientHeight));
}

