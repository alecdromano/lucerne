function computeAdjustedProfitability(order) {
    const gpRev = Number(order && order.grossProfitRevenueAmount || 0);
    const lineItems = Array.isArray(order && order.lineItems) ? order.lineItems : [];
    let adjLaborCost = 0;
    let adjNonLaborCost = 0;

    for (let li = 0; li < lineItems.length; li += 1) {
        const lineItem = lineItems[li] || {};
        const f = lineItem.fields || {};
        const isCommittedLine = !!lineItem.isCommitted;
        const qty = Math.abs(parseFloat(f["Qty"]) || 1);
        const costPerUnit = parseAmountClient(f["Cost"]);
        const isLaborLine = String(f["Make"] || "").trim().toUpperCase() === "LABOR";
        const baseLineCost = isCommittedLine ? (costPerUnit * qty) : costPerUnit;
        if (isLaborLine) {
            const durMatch = String(f["Serial"] || "").match(/;\s*([0-9]+(?:\.[0-9]+)?)/);
            const durHours = durMatch ? parseFloat(durMatch[1]) : NaN;
            const mult = Number.isFinite(durHours) && durHours > 0 ? durHours : 1;
            adjLaborCost += baseLineCost * mult;
        } else {
            adjNonLaborCost += baseLineCost;
        }
    }

    const adjTotalCost = adjLaborCost + adjNonLaborCost;
    const adjGpAmt = gpRev - adjTotalCost;
    const adjGpPct = gpRev > 0 ? Number(((adjGpAmt / gpRev) * 100).toFixed(1)) : null;
    const hasFinancials = gpRev !== 0 || adjTotalCost !== 0;

    return {
        gpRev,
        adjLaborCost,
        adjNonLaborCost,
        adjTotalCost,
        adjGpAmt,
        adjGpPct,
        hasFinancials,
    };
}

function computeFilteredAggregateProfitability() {
    let aggregateProfit = 0;
    let aggregateCost = 0;
    let aggregateLaborCost = 0;
    let aggregatePartsCost = 0;
    let qualifyingCount = 0;

    for (let i = 0; i < matchedIndices.length; i += 1) {
        const order = orders[matchedIndices[i]] || {};
        const profitability = computeAdjustedProfitability(order);
        aggregateProfit += profitability.adjGpAmt;
        aggregateCost += Math.max(0, profitability.adjTotalCost);
        aggregateLaborCost += Math.max(0, profitability.adjLaborCost);
        aggregatePartsCost += Math.max(0, profitability.adjNonLaborCost);
        qualifyingCount += 1;
    }

    return {
        aggregateProfit,
        aggregateCost,
        aggregateLaborCost,
        aggregatePartsCost,
        qualifyingCount,
    };
}

function formatCompactCount(value) {
    const numeric = Math.max(0, Number(value) || 0);
    if (numeric >= 1000000) {
        const m = numeric / 1000000;
        return (m >= 10 ? Math.round(m) : Number(m.toFixed(1))) + "m";
    }
    if (numeric >= 1000) {
        const k = numeric / 1000;
        return (k >= 10 ? Math.round(k) : Number(k.toFixed(1))) + "k";
    }
    return String(Math.round(numeric));
}

function renderOverviewSelectionChart() {
    if (!overviewSelectionChart) return;

    const selectedCount = Math.max(0, matchedIndices.length);
    const totalCount = Math.max(0, orders.length);
    const unselectedCount = Math.max(0, totalCount - selectedCount);

    if (totalCount <= 0) {
        if (overviewSelectionChartInstance) {
            overviewSelectionChartInstance.destroy();
            overviewSelectionChartInstance = null;
        }
        return;
    }

    const chartLabels = ["Viewing", "Not viewing"];
    const chartData = [selectedCount, unselectedCount];
    const chartColors = [overviewActiveRingColor, withAlpha(overviewInactiveRingColor, 0.95)];

    if (overviewSelectionChartInstance) {
        overviewSelectionChartInstance.data.labels = chartLabels;
        overviewSelectionChartInstance.data.datasets[0].data = chartData;
        overviewSelectionChartInstance.data.datasets[0].backgroundColor = chartColors;
        overviewSelectionChartInstance.data.datasets[0].borderWidth = overviewSelectionStrokeWidth;
        overviewSelectionChartInstance.data.datasets[0].borderColor = "#ffffff";
        overviewSelectionChartInstance.options.animation.duration = overviewSelectionAnimationDuration;
        overviewSelectionChartInstance.options.animation.easing = overviewSelectionAnimationEasing;
        overviewSelectionChartInstance.options.cutout = overviewSelectionDonutCutout + "%";
        overviewSelectionChartInstance.update();
        return;
    }

    overviewSelectionChartInstance = new window.Chart(overviewSelectionChart, {
        type: "doughnut",
        data: {
            labels: chartLabels,
            datasets: [
                {
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: overviewSelectionStrokeWidth,
                    borderColor: "#ffffff",
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: overviewSelectionAnimationDuration,
                easing: overviewSelectionAnimationEasing,
            },
            cutout: overviewSelectionDonutCutout + "%",
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(ctx) {
                            const raw = Number(ctx.raw || 0);
                            const total = chartData.reduce(function(sum, value) {
                                return sum + Math.max(0, Number(value || 0));
                            }, 0);
                            const pct = total > 0 ? ((raw / total) * 100) : 0;
                            return ctx.label + ": " + raw.toLocaleString() + " (" + pct.toFixed(2) + "%)";
                        },
                    },
                },
            },
        },
    });
}

