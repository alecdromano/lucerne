function getCssColorVar(name, fallback) {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    return String(value || "").trim() || fallback;
}

function resolveCssVarColor(value, fallback) {
    const text = String(value || "").trim();
    if (!text) return fallback;
    if (/^var\(/.test(text)) {
        try {
            const probe = document.createElement("span");
            probe.style.color = text;
            probe.style.display = "none";
            document.body.appendChild(probe);
            const resolved = window.getComputedStyle(probe).color;
            probe.remove();
            return String(resolved || "").trim() || fallback;
        } catch (error) {
            return fallback;
        }
    }
    return text;
}

const trendSalesLineColor = getCssColorVar("--sale", "#563485");
const trendGpDollarLineColor = getCssColorVar("--profit", "#68974a");
const trendGpPercentLineColor = getCssColorVar("--profit", "#68974a");
const trendOrderCountLineColor = getCssColorVar("--sale", "#563485");
const trendItemsPerSaleLineColor = getCssColorVar("--item", "#9d472b");
const trendNewCustomersLineColor = getCssColorVar("--customer", "#c2b130");
const trendLaborDurationLineColor = getCssColorVar("--labor", "#6d2046");
const trendLaborCostLineColor = getCssColorVar("--labor", "#6d2046");
const trendLaborCostRateLineColor = getCssColorVar("--labor", "#6d2046");
const trendAovLineColor = getCssColorVar("--sale", "#563485");
const trendInventoryRatioLineColor = getCssColorVar("--item", "#9d472b");
const trendInventoryCostLineColor = getCssColorVar("--item", "#9d472b");
const inflationLineColor = "#151515";
const statusPostedColor = resolveCssVarColor(colorConfig(polarChartColors.posted, "var(--posted)"), "#20a1a3");
const statusUnpostedColor = resolveCssVarColor(colorConfig(polarChartColors.unposted, "var(--unposted)"), "#4e6666");
const statusVoidedColor = resolveCssVarColor(colorConfig(polarChartColors.voided, "var(--voided)"), "#976060");
const statusOtherColor = resolveCssVarColor(colorConfig(polarChartColors.other, "var(--other)"), "#717171");
const overviewActiveRingColor = resolveCssVarColor(colorConfig(selectionDonutColors.selected, "var(--order)"), "#00529b");
const overviewInactiveRingColor = resolveCssVarColor(colorConfig(selectionDonutColors.other, "var(--bg)"), "#e4edf5");
const overviewProfitColor = resolveCssVarColor(colorConfig(profitDonutColors.profit, "var(--profit)"), "#68974a");
const overviewLossColor = resolveCssVarColor(colorConfig(profitDonutColors.loss, "var(--loss)"), "#d23333");
const overviewPartsCostColor = resolveCssVarColor(
    colorConfig(profitDonutColors.partsCost || profitDonutColors.cost, "var(--item)"),
    "#9d472b"
);
const overviewLaborCostColor = resolveCssVarColor(colorConfig(profitDonutColors.laborCost, "var(--labor)"), "#6d2046");
let totalStatusCounts = { posted: 0, unposted: 0, voided: 0, other: 0 };
const trendChartInstances = new WeakMap();
let invoiceChartInstances = [];
let overviewChartInstance = null;
let overviewSelectionChartInstance = null;
let overviewProfitChartInstance = null;
let overviewTooltipRoutingBound = false;
let pendingFilterToken = 0;

const CHART_TOOLTIP_Z_INDEX = "2147483000";
const chartTooltipLayerState = new WeakMap();

function getChartTooltipLayerElement(chart) {
    if (!chart || !chart.canvas) return null;
    return chart.canvas.parentElement || chart.canvas;
}

function setChartTooltipLayerElevated(chart, shouldElevate) {
    const layerEl = getChartTooltipLayerElement(chart);
    if (!layerEl) return;

    const prior = chartTooltipLayerState.get(layerEl) || {
        elevated: false,
        zIndex: layerEl.style.zIndex,
        position: layerEl.style.position,
    };

    if (shouldElevate) {
        if (prior.elevated) return;
        const computedPosition = window.getComputedStyle(layerEl).position;
        if (computedPosition === "static") {
            layerEl.style.position = "relative";
        }
        layerEl.style.zIndex = CHART_TOOLTIP_Z_INDEX;
        prior.elevated = true;
        chartTooltipLayerState.set(layerEl, prior);
        return;
    }

    if (!prior.elevated) return;
    layerEl.style.zIndex = prior.zIndex;
    layerEl.style.position = prior.position;
    prior.elevated = false;
    chartTooltipLayerState.set(layerEl, prior);
}

if (window.Chart && typeof window.Chart.register === "function") {
    window.Chart.register({
        id: "raiseTooltipLayer",
        afterDraw: function(chart) {
            const tooltip = chart && chart.tooltip;
            const hasActiveTooltip = !!(
                tooltip
                && Number(tooltip.opacity) > 0
                && typeof tooltip.getActiveElements === "function"
                && tooltip.getActiveElements().length
            );
            setChartTooltipLayerElevated(chart, hasActiveTooltip);
        },
        beforeDestroy: function(chart) {
            setChartTooltipLayerElevated(chart, false);
        },
    });
}

