function renderOverviewAggregateProfitChart() {
    if (!overviewProfitChart) return;

    const summary = computeFilteredAggregateProfitability();
    const profitColor = overviewProfitColor;
    const partsCostColor = overviewPartsCostColor;
    const laborCostColor = overviewLaborCostColor;

    let chartLabels = [];
    let chartData = [];
    let chartColors = [];

    const aggregateProfitValue = Number(summary.aggregateProfit || 0);
    const hasLoss = aggregateProfitValue < 0;
    const gainOrLossSlice = hasLoss ? Math.abs(aggregateProfitValue) : Math.max(0, aggregateProfitValue);
    const gainOrLossLabel = hasLoss ? "Loss" : "Profit";
    const gainOrLossColor = hasLoss ? overviewLossColor : profitColor;
    const partsCostSlice = Math.max(0, Number(summary.aggregatePartsCost || 0));
    const laborCostSlice = Math.max(0, Number(summary.aggregateLaborCost || 0));

    if (gainOrLossSlice > 0 || partsCostSlice > 0 || laborCostSlice > 0) {
        chartLabels = [gainOrLossLabel, "Parts Cost", "Labor Cost"];
        chartData = [gainOrLossSlice, partsCostSlice, laborCostSlice];
        chartColors = [gainOrLossColor, partsCostColor, laborCostColor];
    }

    if (!chartData.length) {
        if (overviewProfitChartInstance) {
            overviewProfitChartInstance.destroy();
            overviewProfitChartInstance = null;
        }
        const ctx = overviewProfitChart.getContext("2d");
        if (ctx) {
            const width = overviewProfitChart.width;
            const height = overviewProfitChart.height;
            ctx.clearRect(0, 0, width, height);
        }
        return;
    }

    if (overviewProfitChartInstance) {
        overviewProfitChartInstance.data.labels = chartLabels;
        overviewProfitChartInstance.data.datasets[0].data = chartData;
        overviewProfitChartInstance.data.datasets[0].backgroundColor = chartColors;
        overviewProfitChartInstance.data.datasets[0].borderWidth = overviewProfitStrokeWidth;
        overviewProfitChartInstance.data.datasets[0].borderColor = "#ffffff";
        overviewProfitChartInstance.options.animation.duration = overviewProfitAnimationDuration;
        overviewProfitChartInstance.options.animation.easing = overviewProfitAnimationEasing;
        overviewProfitChartInstance.options.cutout = overviewProfitDonutCutout + "%";
        overviewProfitChartInstance.update();
        return;
    }

    overviewProfitChartInstance = new window.Chart(overviewProfitChart, {
        type: "doughnut",
        data: {
            labels: chartLabels,
            datasets: [
                {
                    data: chartData,
                    backgroundColor: chartColors,
                    borderWidth: overviewProfitStrokeWidth,
                    borderColor: "#ffffff",
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: overviewProfitAnimationDuration,
                easing: overviewProfitAnimationEasing,
            },
            cutout: overviewProfitDonutCutout + "%",
            plugins: {
                legend: {
                    display: false,
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        label: function(ctx) {
                            const raw = Number(ctx.raw || 0);
                            const signedValue = ctx.label === "Loss" ? -Math.abs(raw) : raw;
                            const money = (signedValue < 0 ? "-$" : "$") + Math.abs(signedValue).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            });
                            return ctx.label + ": " + money;
                        },
                    },
                },
            },
        },
    });
}

function renderOverviewCharts() {
    renderOverviewStatusChart();
    renderOverviewSelectionChart();
    renderOverviewAggregateProfitChart();
}

function clearOverviewTooltips() {
    const charts = [overviewSelectionChartInstance, overviewProfitChartInstance, overviewChartInstance];
    for (let i = 0; i < charts.length; i += 1) {
        const chart = charts[i];
        if (!chart) continue;
        chart.setActiveElements([]);
        if (chart.tooltip) {
            chart.tooltip.setActiveElements([], { x: 0, y: 0 });
        }
        chart.update("none");
    }
}

function getOverviewChartHit(chart, clientX, clientY) {
    if (!chart || !chart.canvas) return null;

    const rect = chart.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    if (cssX < 0 || cssY < 0 || cssX > rect.width || cssY > rect.height) return null;

    const scaleX = chart.width / rect.width;
    const scaleY = chart.height / rect.height;
    const canvasX = cssX * scaleX;
    const canvasY = cssY * scaleY;

    const hitElements = [];
    const datasets = chart.data && Array.isArray(chart.data.datasets) ? chart.data.datasets : [];
    for (let di = 0; di < datasets.length; di += 1) {
        const meta = chart.getDatasetMeta(di);
        const points = meta && Array.isArray(meta.data) ? meta.data : [];
        for (let pi = 0; pi < points.length; pi += 1) {
            const arc = points[pi];
            if (!arc || typeof arc.inRange !== "function") continue;
            if (arc.inRange(canvasX, canvasY, true)) {
                hitElements.push({
                    datasetIndex: di,
                    index: pi,
                });
            }
        }
    }

    if (!hitElements.length) return null;
    return {
        chart: chart,
        elements: hitElements,
        x: canvasX,
        y: canvasY,
    };
}

function bindOverviewTooltipRouting() {
    if (!overviewChartWrap || overviewTooltipRoutingBound) return;
    overviewTooltipRoutingBound = true;

    overviewChartWrap.addEventListener("pointermove", function(event) {
        const charts = [overviewSelectionChartInstance, overviewProfitChartInstance, overviewChartInstance];
        let activeHit = null;

        for (let i = 0; i < charts.length; i += 1) {
            const chart = charts[i];
            const hit = getOverviewChartHit(chart, event.clientX, event.clientY);
            if (hit) {
                chart.setActiveElements(hit.elements);
                if (chart.tooltip) {
                    chart.tooltip.setActiveElements(hit.elements, { x: hit.x, y: hit.y });
                }
                chart.update("none");
                activeHit = hit;
                break;
            }
        }

        for (let i = 0; i < charts.length; i += 1) {
            const chart = charts[i];
            if (!chart || (activeHit && chart === activeHit.chart)) continue;
            chart.setActiveElements([]);
            if (chart.tooltip) {
                chart.tooltip.setActiveElements([], { x: 0, y: 0 });
            }
            chart.update("none");
        }
    });

    overviewChartWrap.addEventListener("mouseleave", clearOverviewTooltips);
}
