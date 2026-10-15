function renderFundamentals(order) {
    const inner = createEl("div", "fund-inner");

    const gpRev = Number(order.grossProfitRevenueAmount || 0);
    const totalAmount = Number(order.totalAmount || 0);
    const paidAmount = Number(order.paidAmount || 0);
    const balanceDueAmount = Number(order.balanceDueAmount || 0);
    const paymentAmount = getOrderCollectedAmount(order);
    const paidRatio = totalAmount > 0 ? (paymentAmount / totalAmount) : 0;
    const isFullyPaid = totalAmount > 0 && paymentAmount > 0 && balanceDueAmount <= 0;
    const isMostlyPaidOrBetter = isFullyPaid || (totalAmount > 0 && paidRatio >= 0.95);
    if (!isMostlyPaidOrBetter) {
        return null;
    }

    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const isUnposted = order.statusCode !== "P" && order.statusCode !== "V";
    const profitability = computeAdjustedProfitability(order);
    const adjLaborCost = profitability.adjLaborCost;
    const adjNonLaborCost = profitability.adjNonLaborCost;
    const adjTotalCost = profitability.adjTotalCost;
    const adjGpAmt = profitability.adjGpAmt;
    const adjGpPct = profitability.adjGpPct;
    const hasFinancials = profitability.hasFinancials;
    const profitSlice = Math.max(0, adjGpAmt);
    const hasGpChartData = hasFinancials && (profitSlice > 0 || adjNonLaborCost > 0 || adjLaborCost > 0);

    if (!hasGpChartData) {
        return null;
    }

    function fmtMoney(n) {
        return "$" + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function buildLegendEntries(labels, values, colors, valueFormatter) {
        const entries = [];
        const total = values.reduce(function(sum, value) {
            return sum + Math.max(0, Number(value || 0));
        }, 0);

        for (let i = 0; i < labels.length; i += 1) {
            const numericValue = Math.max(0, Number(values[i] || 0));
            const pct = total > 0 ? ((numericValue / total) * 100) : 0;
            entries.push({
                label: labels[i],
                color: colors[i] || "#8da4b8",
                valueText: valueFormatter(numericValue),
                pctText: pct.toFixed(2) + "%",
            });
        }

        return entries;
    }

    function renderCombinedLegend(entries) {
        const legend = createEl("div", "fund-legend");
        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            const row = createEl("div", "fund-legend-item");
            const swatch = createEl("span", "fund-legend-swatch");
            swatch.style.background = entry.color;
            row.appendChild(swatch);
            row.appendChild(createEl("span", "", entry.label + " " + entry.valueText + " (" + entry.pctText + ")"));
            legend.appendChild(row);
        }
        return legend;
    }

    // --- Charts ---
    const chartsSection = createEl("div", "fund-charts");
    const combinedLegendEntries = [];

    // Chart 1: Profitability pie (Profit vs. Parts Cost vs. Labor Cost)
    const gpWrap = createEl("div", "fund-chart-wrap");
    if (hasGpChartData) {
        const gpCanvas = document.createElement("canvas");
        gpCanvas.className = "fund-canvas";
        gpCanvas.width = 130;
        gpCanvas.height = 130;
        gpWrap.appendChild(gpCanvas);

        const profitColor = getCssColorVar("--profit", "#68974a");
        const lossColor = getCssColorVar("--loss", "#d23333");
        const partsColor = getCssColorVar("--item", "#9d472b");
        const laborColor = getCssColorVar("--labor", "#6d2046");

        const hasLoss = adjGpAmt < 0;
        const gainOrLossSlice = hasLoss ? Math.abs(adjGpAmt) : profitSlice;
        const gainOrLossLabel = hasLoss ? "Loss" : "Profit";
        const gainOrLossColor = hasLoss ? lossColor : profitColor;
        const chartData = [gainOrLossSlice, Math.max(0, adjNonLaborCost), Math.max(0, adjLaborCost)];
        const chartColors = [gainOrLossColor, partsColor, laborColor];
        const chartLabels = [gainOrLossLabel, "Parts Cost", "Labor Cost"];
        const gpLegendEntries = buildLegendEntries(chartLabels, chartData, chartColors, fmtMoney);

        if (hasLoss && gpLegendEntries.length) {
            gpLegendEntries[0].valueText = "-$" + Math.abs(adjGpAmt).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            gpLegendEntries[0].pctText = Number.isFinite(adjGpPct)
                ? (adjGpPct.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%")
                : "-";
        }

        for (let i = 0; i < gpLegendEntries.length; i += 1) {
            combinedLegendEntries.push(gpLegendEntries[i]);
        }

        const gpInst = new window.Chart(gpCanvas, {
            type: "pie",
            data: {
                labels: chartLabels,
                datasets: [{ data: chartData, backgroundColor: chartColors, borderWidth: 2, borderColor: "#fff" }],
            },
            options: {
                responsive: false,
                animation: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        enabled: false,
                    },
                },
            },
        });
        invoiceChartInstances.push(gpInst);
    } else {
        gpWrap.appendChild(createEl("div", "fund-no-data", hasFinancials ? "No profitability data" : "No cost/price data"));
    }
    chartsSection.appendChild(gpWrap);

    inner.appendChild(chartsSection);
    inner.appendChild(renderCombinedLegend(combinedLegendEntries));

    if (order.costDataIncomplete) {
        const warn = createEl("div", "fund-warn", "\u26A0\uFE0F Some items couldn't be matched to inventory — cost is estimated");
        inner.appendChild(warn);
    }

    return inner;
}

