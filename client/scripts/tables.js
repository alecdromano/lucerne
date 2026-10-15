function renderPairsTable(pairs) {
    if (!pairs || !pairs.length) {
        return createEl("div", "muted", "(no data)");
    }
    const table = createEl("table");
    const tbody = createEl("tbody");
    for (let i = 0; i < pairs.length; i += 1) {
        const label = String(pairs[i][0] || "").trim();
        const rawValue = pairs[i][1];
        const displayValue = isCurrencyFieldLabel(label)
            ? formatCurrencyClient(rawValue)
            : rawValue;
        const tr = createEl("tr");
        tr.appendChild(createEl("td", "key", label));
        tr.appendChild(createEl("td", "", displayValue));
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

function renderInvoiceDetailsTable(order) {
    const table = createEl("table");
    const tbody = createEl("tbody");
    const pairs = order && Array.isArray(order.invoiceMeta) ? order.invoiceMeta : [];

    for (let i = 0; i < pairs.length; i += 1) {
        const tr = createEl("tr");
        tr.appendChild(createEl("td", "key", pairs[i][0]));
        tr.appendChild(createEl("td", "", pairs[i][1]));
        tbody.appendChild(tr);
    }

    const statusCode = String(order && order.statusCode || "").toUpperCase();
    const costCalcValue = (statusCode === "P" || statusCode === "V") ? "Historical" : "Latest";
    const costCalcRow = createEl("tr");
    costCalcRow.appendChild(createEl("td", "key", "Cost Calculation"));
    costCalcRow.appendChild(createEl("td", "", costCalcValue));
    tbody.appendChild(costCalcRow);

    const perfContent = renderFundamentals(order);
    if (perfContent) {
        const perfRow = createEl("tr");
        perfRow.appendChild(createEl("td", "key", "Performance"));
        const perfValue = createEl("td", "fund-performance-cell");
        perfValue.appendChild(perfContent);
        perfRow.appendChild(perfValue);
        tbody.appendChild(perfRow);
    }

    table.appendChild(tbody);
    return table;
}

function getOrderCollectedAmount(order) {
    const explicitCollectedAmount = Number(order && order.collectedAmount);
    if (Number.isFinite(explicitCollectedAmount) && explicitCollectedAmount !== 0) return explicitCollectedAmount;

    const paymentMethodTotals = Array.isArray(order && order.paymentMethodTotals) ? order.paymentMethodTotals : [];
    if (paymentMethodTotals.length) {
        return paymentMethodTotals.reduce(function(sum, entry) {
            return sum + Number(entry && entry.amount || 0);
        }, 0);
    }

    return Number(order && order.paidAmount || 0) + Number(order && order.depositAmount || 0);
}

function formatPaidPortion(collectedAmount, totalAmount) {
    const collected = Number(collectedAmount || 0);
    const total = Number(totalAmount || 0);
    if (!Number.isFinite(total) || total <= 0) return "—";

    const percentValue = (collected / total) * 100;
    const hasRemainingBalance = collected < total;

    for (let decimals = 1; decimals <= 4; decimals += 1) {
        const rounded = Number(percentValue.toFixed(decimals));
        if (!hasRemainingBalance || rounded < 100) {
            return rounded.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }) + "%";
        }
    }

    return percentValue.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
    }) + "%";
}

function buildFinancialPairs(order) {
    const rawPairs = Array.isArray(order && order.totals) ? order.totals : [];
    const hiddenLabels = new Set(["Deposit", "Paid Cash", "Paid Check", "Paid Card", "Paid Open", "Paid House"]);
    const pairs = rawPairs.filter(function(pair) {
        const label = String(pair && pair[0] || "").trim();
        return label && !hiddenLabels.has(label);
    }).map(function(pair) {
        return [pair[0], pair[1]];
    });

    const paymentMethodTotals = Array.isArray(order && order.paymentMethodTotals) ? order.paymentMethodTotals : [];
    const balanceDueIndex = pairs.findIndex(function(pair) {
        return String(pair && pair[0] || "") === "Balance Due";
    });
    const insertionIndex = balanceDueIndex >= 0 ? balanceDueIndex : pairs.length;
    const paymentPairs = paymentMethodTotals.map(function(entry) {
        const label = entry && (entry.label || (entry.method ? ("Paid " + entry.method) : "Paid"));
        return [label, entry && entry.amount];
    });
    if (paymentPairs.length) pairs.splice(insertionIndex, 0, ...paymentPairs);

    const collectedAmount = getOrderCollectedAmount(order);
    const totalAmount = Number(order && order.totalAmount || 0);
    const paidPortion = formatPaidPortion(collectedAmount, totalAmount);
    const portionInsertIndex = pairs.findIndex(function(pair) {
        return String(pair && pair[0] || "") === "Balance Due";
    });
    if (portionInsertIndex >= 0) pairs.splice(portionInsertIndex, 0, ["Portion", paidPortion]);
    else pairs.push(["Portion", paidPortion]);

    return pairs;
}

function renderLineItemsTable(items) {
    if (!items || !items.length) {
        return createEl("div", "muted", "No line items found");
    }

    const columns = ["Qty", "Description", "Make", "Model", "Serial / Multiplier", "Unit Cost", "Cost", "Unit Price", "Subtotal"];
    const table = createEl("table", "items");
    const thead = createEl("thead");
    const headRow = createEl("tr");
    for (let i = 0; i < columns.length; i += 1) {
        headRow.appendChild(createEl("th", "", columns[i]));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = createEl("tbody");
    for (let i = 0; i < items.length; i += 1) {
        const lineItem = items[i] || {};
        const f = lineItem.fields || {};
        const isCommittedLine = !!lineItem.isCommitted;
        const make = String(f["Make"] == null ? "" : f["Make"]).trim().toUpperCase();
        const rawQty = String(f["Qty"] == null ? "" : f["Qty"]).trim().replace(/[,$\s]/g, "");
        const qtyValue = Number.parseFloat(rawQty);
        const hasKnownQty = Number.isFinite(qtyValue) && qtyValue !== 0;
        const qtyAbs = hasKnownQty ? Math.abs(qtyValue) : NaN;
        const rawCost = String(f["Cost"] == null ? "" : f["Cost"]).trim();
        const hasKnownCost = rawCost !== "" && /[0-9]/.test(rawCost);
        const lineCostValue = hasKnownCost ? parseAmountClient(f["Cost"]) : NaN;
        const hasDivisor = Number.isFinite(qtyAbs) && qtyAbs > 0;
        const baseUnitCostValue = (hasKnownCost && Number.isFinite(lineCostValue))
            ? (isCommittedLine
                ? lineCostValue
                : (hasDivisor ? (lineCostValue / qtyAbs) : NaN))
            : NaN;
        const unitCostText = Number.isFinite(baseUnitCostValue)
            ? formatCurrencyClient(baseUnitCostValue)
            : "Unknown";
        const hoursMatch = make === "LABOR"
            ? String(f["Serial"] == null ? "" : f["Serial"]).trim().match(/;\s*([0-9]+(?:\.[0-9]+)?)/)
            : null;
        const laborHoursMultiplier = hoursMatch ? Number.parseFloat(hoursMatch[1]) : 1;
        const baseLineCostValue = Number.isFinite(baseUnitCostValue) && hasDivisor
            ? (baseUnitCostValue * qtyAbs)
            : lineCostValue;
        const costValue = make === "LABOR" && Number.isFinite(baseLineCostValue)
            ? (baseLineCostValue * (Number.isFinite(laborHoursMultiplier) && laborHoursMultiplier > 0 ? laborHoursMultiplier : 1))
            : baseLineCostValue;
        const costText = Number.isFinite(costValue) ? formatCurrencyClient(costValue) : formatCurrencyClient(f["Cost"]);
        const rawPrice = String(f["Price"] == null ? "" : f["Price"]).trim();
        const hasKnownPrice = rawPrice !== "" && /[0-9]/.test(rawPrice);
        const priceText = hasKnownPrice ? formatCurrencyClient(f["Price"]) : "Unknown";
        const subtotalText = hasKnownPrice ? formatCurrencyClient(f["Subtotal"]) : "Unknown";
        const tr = createEl("tr");
        tr.appendChild(createEl("td", "", f["Qty"]));
        tr.appendChild(createEl("td", "", f["Description"]));
        tr.appendChild(createEl("td", "", f["Make"]));
        tr.appendChild(createEl("td", "", f["Model"]));
        const serialCell = createEl("td", "", f["Serial"]);
        if (make === "LABOR" && hoursMatch) {
            const laborColor = getCssColorVar("--labor", "#6d2046");
            serialCell.style.background = withAlpha(laborColor, 0.12);
            serialCell.style.color = laborColor;
            serialCell.style.fontWeight = "700";
        }
        tr.appendChild(serialCell);
        tr.appendChild(createEl("td", "", unitCostText));
        tr.appendChild(createEl("td", "", costText));
        tr.appendChild(createEl("td", "", priceText));
        tr.appendChild(createEl("td", "", subtotalText));
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

function renderPaymentTransactionsTable(items) {
    if (!items || !items.length) {
        return createEl("div", "muted", "No payment transactions found");
    }

    const columns = ["Date", "Time", "Type", "Method", "Amount", "Reference", "Notes"];
    const table = createEl("table", "items");
    const thead = createEl("thead");
    const headRow = createEl("tr");
    for (let i = 0; i < columns.length; i += 1) {
        headRow.appendChild(createEl("th", "", columns[i]));
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = createEl("tbody");
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i] || {};
        const tr = createEl("tr");
        tr.appendChild(createEl("td", "", item.transactionDate || "—"));
        tr.appendChild(createEl("td", "", item.transactionTime || "—"));
        tr.appendChild(createEl("td", "", item.type || "—"));
        tr.appendChild(createEl("td", "", item.method || "—"));
        tr.appendChild(createEl("td", "", Number.isFinite(Number(item.amount)) ? formatCurrencyClient(item.amount) : "—"));
        tr.appendChild(createEl("td", "", item.reference || "—"));
        tr.appendChild(createEl("td", "", item.notes || "—"));
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
}

function destroyInvoiceCharts() {
    for (let i = 0; i < invoiceChartInstances.length; i += 1) {
        try { invoiceChartInstances[i].destroy(); } catch (e) {}
    }
    invoiceChartInstances = [];
}

