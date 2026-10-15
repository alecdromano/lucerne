const payload = JSON.parse(document.getElementById("payload").textContent);
const overviewChartsConfig = payload && payload.config && payload.config.overviewCharts && typeof payload.config.overviewCharts === "object"
    ? payload.config.overviewCharts
    : {};
const overviewChartsByType = overviewChartsConfig.charts && typeof overviewChartsConfig.charts === "object"
    ? overviewChartsConfig.charts
    : {};
const polarChartConfig = overviewChartsByType.polar && typeof overviewChartsByType.polar === "object"
    ? overviewChartsByType.polar
    : {};
const selectionDonutChartConfig = overviewChartsByType.selectionDonut && typeof overviewChartsByType.selectionDonut === "object"
    ? overviewChartsByType.selectionDonut
    : {};
const profitDonutChartConfig = overviewChartsByType.profitDonut && typeof overviewChartsByType.profitDonut === "object"
    ? overviewChartsByType.profitDonut
    : {};
const polarChartColors = polarChartConfig.colors && typeof polarChartConfig.colors === "object"
    ? polarChartConfig.colors
    : {};
const selectionDonutColors = selectionDonutChartConfig.colors && typeof selectionDonutChartConfig.colors === "object"
    ? selectionDonutChartConfig.colors
    : {};
const profitDonutColors = profitDonutChartConfig.colors && typeof profitDonutChartConfig.colors === "object"
    ? profitDonutChartConfig.colors
    : {};
function numberConfig(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}
function boundedNumberConfig(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
}
function clampPercent(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(95, Math.round(numeric)));
}
function textConfig(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
}
function colorConfig(value, fallback) {
    const text = String(value || "").trim();
    return text || fallback;
}

const overviewPolarStrokeWidth = numberConfig(polarChartConfig.strokePx, 0);
const overviewSelectionStrokeWidth = numberConfig(selectionDonutChartConfig.strokePx, 3);
const overviewProfitStrokeWidth = numberConfig(profitDonutChartConfig.strokePx, 3);
const overviewSelectionDonutCutout = clampPercent(selectionDonutChartConfig.cutoutPct, 74);
const overviewProfitDonutCutout = clampPercent(profitDonutChartConfig.cutoutPct, 84);
const overviewWeightExponent = boundedNumberConfig(numberConfig(polarChartConfig.weightExponent, 0.45), 0.05, 1, 0.45);
const overviewPolarInsetFactor = boundedNumberConfig(numberConfig(polarChartConfig.insetFactor, 1.22), 1, 2, 1.22);
const overviewPolarStartAngle = boundedNumberConfig(numberConfig(polarChartConfig.startAngle, 45), 0, 360, 45);
const overviewPolarRingCount = Math.round(boundedNumberConfig(numberConfig(polarChartConfig.ringCount, 5), 2, 10, 5));
const overviewPolarFillAlpha = boundedNumberConfig(numberConfig(polarChartConfig.fillAlpha, 0.82), 0, 1, 0.82);
const overviewPolarTickFontSize = Math.round(boundedNumberConfig(numberConfig(polarChartConfig.tickFontSize, 10), 8, 16, 10));
const overviewPolarTickFontWeight = textConfig(polarChartConfig.tickFontWeight, "600");
const overviewPolarTickColorConfig = colorConfig(polarChartColors.ticks, "#6f8395");
const overviewPolarGridColor = colorConfig(polarChartColors.grid, "rgba(60, 91, 118, 0.17)");
const overviewPolarAngleLineColor = colorConfig(polarChartColors.angleLines, "rgba(60, 91, 118, 0.14)");

const overviewPolarAnimationDuration = Math.round(boundedNumberConfig(numberConfig(polarChartConfig.animationDurationMs, 320), 0, 4000, 320));
const overviewPolarAnimationEasing = textConfig(polarChartConfig.animationEasing, "easeOutCubic");
const overviewSelectionAnimationDuration = Math.round(boundedNumberConfig(numberConfig(selectionDonutChartConfig.animationDurationMs, 320), 0, 4000, 320));
const overviewSelectionAnimationEasing = textConfig(selectionDonutChartConfig.animationEasing, "easeOutCubic");
const overviewProfitAnimationDuration = Math.round(boundedNumberConfig(numberConfig(profitDonutChartConfig.animationDurationMs, 320), 0, 4000, 320));
const overviewProfitAnimationEasing = textConfig(profitDonutChartConfig.animationEasing, "easeOutCubic");

const overviewPolarSizePct = Math.round(boundedNumberConfig(numberConfig(polarChartConfig.sizePct, 72), 1, 100, 72));
const overviewSelectionSizePct = Math.round(boundedNumberConfig(numberConfig(selectionDonutChartConfig.sizePct, 78), 1, 100, 78));
const overviewProfitSizePct = Math.round(boundedNumberConfig(numberConfig(profitDonutChartConfig.sizePct, 26), 1, 100, 26));

const rootStyle = document.documentElement.style;
rootStyle.setProperty("--overview-chart-padding", Math.round(boundedNumberConfig(numberConfig(overviewChartsConfig.chartPaddingPx, 10), 0, 80, 10)) + "px");
rootStyle.setProperty("--overview-polar-size", overviewPolarSizePct + "%");
rootStyle.setProperty("--overview-selection-size", overviewSelectionSizePct + "%");
rootStyle.setProperty("--overview-selection-min-size", "0px");
rootStyle.setProperty("--overview-selection-z", "3");
rootStyle.setProperty("--overview-profit-size", overviewProfitSizePct + "%");
rootStyle.setProperty("--overview-profit-min-size", "0px");
rootStyle.setProperty("--overview-profit-z", "2");
const orders = payload.orders || [];
const inflation = payload.inflation || null;
const inflationByMonth = inflation && inflation.monthlyDollarIndex && typeof inflation.monthlyDollarIndex === "object"
    ? inflation.monthlyDollarIndex
    : {};
const ordersPane = document.getElementById("ordersPane");
const container = document.getElementById("orders");
const loadMore = document.getElementById("loadMore");
const appLoading = document.getElementById("appLoading");
const appLoadingText = document.getElementById("appLoadingText");
if (appLoadingText && payload && payload.generatedAt) {
    const formattedGenDate = formatDisplayDateClient(payload.generatedAt);
    if (formattedGenDate) {
        appLoadingText.textContent = "Loading TSS archive from " + formattedGenDate + "...";
    }
}

const headerLogo = document.getElementById("headerLogo");
if (headerLogo) {
    headerLogo.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 248.87 94.734" width="248.87" height="94.734" aria-hidden="true"><g><path fill="currentColor" d="M106.299 3.091 C111.971 1.033 118.398 0 125.543 0 C132.619 0 139.163 0.99 145.146 2.965 C151.174 4.954 156.311 7.585 160.525 10.839 C163.979 13.506 164.174 18.662 160.93 21.582 L153.808 27.993 C151.448 30.118 147.954 30.387 145.296 28.651 C142.526 26.841 139.479 25.381 136.142 24.264 C132.954 23.198 129.43 22.667 125.543 22.667 C121.029 22.667 117.479 23.394 115.058 24.803 C113.301 25.826 113.234 26.486 113.234 27.065 C113.234 27.577 113.298 27.76 113.618 28.058 C114.711 29.077 116.144 29.928 117.957 30.635 C120.494 31.625 123.044 32.508 125.635 33.344 L140.339 38.089 C147.321 40.309 153.149 43.192 157.792 46.721 C163.543 51.092 166.57 57.567 166.57 65.532 C166.57 67.189 166.405 68.811 166.075 70.391 L173.043 64.385 C175.587 62.192 179.331 62.116 181.962 64.203 C185.002 66.613 188.666 68.512 192.991 69.916 C197.41 71.352 201.982 72.067 206.734 72.067 C212.218 72.067 216.426 71.217 219.054 69.601 C220.937 68.443 221.417 67.52 221.417 66.363 C221.417 65.585 221.298 65.033 221.089 64.817 C220.205 63.903 218.921 63.091 217.192 62.349 C214.784 61.317 212.038 60.278 208.954 59.232 L194.112 54.376 C194.089 54.369 194.066 54.361 194.042 54.353 C190.454 53.138 186.874 51.622 183.305 49.808 C179.155 47.699 175.689 44.935 172.959 41.556 C169.843 37.698 168.239 32.98 168.239 27.658 C168.239 21.979 170.271 16.776 174.215 12.366 C177.782 8.378 182.605 5.267 188.598 3.091 C194.27 1.033 200.697 0 207.842 0 C214.918 0 221.462 0.99 227.446 2.965 C233.474 4.954 238.61 7.585 242.824 10.839 C246.279 13.506 246.473 18.662 243.229 21.582 L236.107 27.993 C233.747 30.118 230.253 30.387 227.595 28.651 C224.825 26.841 221.778 25.381 218.441 24.264 C215.253 23.198 211.73 22.667 207.842 22.667 C203.329 22.667 199.778 23.394 197.357 24.803 C195.6 25.826 195.533 26.486 195.533 27.065 C195.533 27.577 195.597 27.76 195.917 28.058 C197.011 29.077 198.444 29.928 200.257 30.635 C202.793 31.625 205.343 32.508 207.934 33.344 L222.639 38.089 C229.62 40.309 235.448 43.192 240.091 46.721 C245.842 51.092 248.87 57.567 248.87 65.532 C248.87 71.305 246.858 76.648 242.938 81.276 C239.322 85.545 234.302 88.913 227.969 91.312 C221.954 93.591 214.809 94.734 206.576 94.734 C198.438 94.734 190.911 93.584 184.024 91.288 C177.065 88.968 170.977 85.718 165.793 81.558 C164.457 80.486 163.631 79.04 163.319 77.507 C162.557 78.808 161.663 80.067 160.639 81.276 C157.023 85.545 152.002 88.913 145.67 91.312 C139.654 93.591 132.51 94.734 124.277 94.734 C116.138 94.734 108.611 93.584 101.725 91.288 C94.766 88.968 88.678 85.718 83.494 81.558 C80.084 78.822 79.993 73.651 83.305 70.797 L90.744 64.385 C93.288 62.192 97.031 62.116 99.663 64.203 C102.703 66.613 106.367 68.512 110.691 69.916 C115.11 71.352 119.683 72.067 124.435 72.067 C129.918 72.067 134.126 71.217 136.754 69.601 C138.638 68.443 139.118 67.52 139.118 66.363 C139.118 65.585 138.998 65.033 138.789 64.817 C137.906 63.903 136.622 63.091 134.892 62.349 C132.484 61.317 129.738 60.278 126.654 59.232 L111.812 54.376 C111.789 54.369 111.766 54.361 111.743 54.353 C108.155 53.138 104.575 51.622 101.005 49.808 C96.855 47.699 93.39 44.935 90.66 41.556 C87.543 37.698 85.94 32.98 85.94 27.658 C85.94 25.997 86.113 24.377 86.458 22.805 C85.431 23.397 84.239 23.736 82.969 23.736 L58.632 23.736 L58.632 86.309 C58.632 90.175 55.498 93.309 51.632 93.309 L38.337 93.309 C34.471 93.309 31.337 90.175 31.337 86.309 L31.337 23.736 L7 23.736 C3.134 23.736 0 20.602 0 16.736 L0 8.425 C0 4.559 3.134 1.425 7 1.425 L82.969 1.425 C86.835 1.425 89.969 4.559 89.969 8.425 L89.969 14.828 C90.555 13.983 91.204 13.162 91.916 12.366 C95.483 8.378 100.306 5.267 106.299 3.091 Z"/></g></svg>';
}
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");

// Direct minimum-gap inputs for each pairwise date delta on an order.
const deltaPairMap = [
    { orderKey: "deltaCreateToInvoice", textId: "delta-pair-created-invoiced" },
    { orderKey: "deltaCreateToModified", textId: "delta-pair-created-modified" },
    { orderKey: "deltaCreateToFirstPaid", textId: "delta-pair-created-first-paid" },
    { orderKey: "deltaCreateToPaid", textId: "delta-pair-created-paid" },
    { orderKey: "deltaInvoiceToModified", textId: "delta-pair-invoiced-modified" },
    { orderKey: "deltaInvoiceToFirstPaid", textId: "delta-pair-invoiced-first-paid" },
    { orderKey: "deltaInvoiceToPaid", textId: "delta-pair-invoiced-paid" },
    { orderKey: "deltaModifiedToFirstPaid", textId: "delta-pair-modified-first-paid" },
    { orderKey: "deltaModifiedToPaid", textId: "delta-pair-modified-paid" },
    { orderKey: "deltaFirstPaidToPaid", textId: "delta-pair-first-paid-paid" },
];
const deltaPairTextEls = {};
deltaPairMap.forEach(pair => {
    deltaPairTextEls[pair.textId] = document.getElementById(pair.textId);
});

deltaPairMap.forEach(function(pair) {
    const el = deltaPairTextEls[pair.textId];
    if (!el) return;
    function commitPairValue() {
        let gap = parseInt(el.value, 10);
        if (!Number.isFinite(gap) || gap < 0) gap = 0;
        if (gap > 999) gap = 999;
        el.value = String(gap);
        applyFilter();
    }
    el.addEventListener("change", commitPairValue);
    el.addEventListener("keydown", function(evt) {
        if (evt.key === "Enter") {
            evt.preventDefault();
            commitPairValue();
            el.blur();
        }
    });
});


const tagPosted = document.getElementById("tagPosted");
const tagUnposted = document.getElementById("tagUnposted");
const tagVoided = document.getElementById("tagVoided");
const tagBlankStatus = document.getElementById("tagBlankStatus");
const tagMarked = document.getElementById("tagMarked");
const tagPayments = document.getElementById("tagPayments");
const tagDeposits = document.getElementById("tagDeposits");
const tagBalanceDue = document.getElementById("tagBalanceDue");
const tagFullyPaid = document.getElementById("tagFullyPaid");
const tagMostlyPaid = document.getElementById("tagMostlyPaid");
const tagHasLabor = document.getElementById("tagHasLabor");
const tagHasLaborDuration = document.getElementById("tagHasLaborDuration");
const salespersonFilters = document.getElementById("salespersonFilters");
const salespersonEmpty = document.getElementById("salespersonEmpty");
const customTagFilters = document.getElementById("customTagFilters");
const customTagEmpty = document.getElementById("customTagEmpty");
const overviewChartWrap = document.getElementById("overviewChartWrap");
const overviewStatusChart = document.getElementById("overviewStatusChart");
const overviewSelectionChart = document.getElementById("overviewSelectionChart");
const overviewProfitChart = document.getElementById("overviewProfitChart");
const overviewLegend = document.getElementById("overviewLegend");
const overviewSummary = document.getElementById("overviewSummary");
const trendList = document.getElementById("trendList");
const trendModal = document.getElementById("trendModal");
const trendModalTitle = document.getElementById("trendModalTitle");
const trendModalSubtitle = document.getElementById("trendModalSubtitle");
const trendModalClose = document.getElementById("trendModalClose");
const trendModalCanvas = document.getElementById("trendModalCanvas");
const modalExcludeEdgeMonthsToggle = document.getElementById("modalExcludeEdgeMonthsToggle");
const modalSmoothLineToggle = document.getElementById("modalSmoothLineToggle");
const modalClampOutliersToggle = document.getElementById("modalClampOutliersToggle");
const modalTrendClampRange = document.getElementById("modalTrendClampRange");
const modalTrendClampReset = document.getElementById("modalTrendClampReset");
const excludeEdgeMonthsToggle = document.getElementById("excludeEdgeMonthsToggle");
const clampOutliersToggle = document.getElementById("clampOutliersToggle");
const trendClampRange = document.getElementById("trendClampRange");
const trendClampReset = document.getElementById("trendClampReset");
const search = document.getElementById("search");
const sortBy = document.getElementById("sortBy");
const sortDir = document.getElementById("sortDir");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clear");
const printBtn = document.getElementById("printBtn");
const nextstep = document.getElementById("nextstep");
const nextstepStats = document.getElementById("nextstepStats");
const nextstepPlatform = document.getElementById("nextstepPlatform");
const nextstepMigrateBtn = document.getElementById("nextstepMigrateBtn");
const STORAGE_UI_KEY = "tss-archive-ui-state-v1";
const STORAGE_MARKED_KEY = "tss-archive-marked-invoices-v1";
const STORAGE_ORDER_TAGS_KEY = "tss-archive-order-tags-v1";
const CHUNK_LOAD_COOLDOWN_MS = 120;
const MAX_TAGS_PER_ORDER = 4;
const TREND_CLAMP_SLIDER_MIN = 0;
const TREND_CLAMP_SLIDER_MAX = 4;
const TREND_CLAMP_SLIDER_STEP = 0.25;
const TREND_CLAMP_DEFAULT = 2.5;
const PRINT_MAX_ORDERS = 200;

const PAGE_SIZE = 40;
let matchedIndices = orders.map(function(_, idx) { return idx; });
let renderedCount = 0;
let markedInvoiceNumbers = new Set();
let orderTags = new Map();
let selectedSalespeople = new Set();
let selectedCustomTags = new Set();
let isRenderingChunk = false;
let lastChunkLoadAt = 0;
let includePosted = true;
let includeUnposted = true;
let includeVoided = true;
let includeBlankStatus = true;
let requireMarked = false;
let requirePayments = false;
let requireDeposit = false;
let requireBalanceDue = false;
let requireFullyPaid = false;
let requireMostlyPaid = false;
let requireLabor = false;
let requireLaborDuration = false;
let excludeEdgeMonths = true;
let clampOutliersEnabled = true;
let trendClampIqrMultiplier = TREND_CLAMP_DEFAULT;
let trendClampLastNonZero = TREND_CLAMP_DEFAULT;
let modalSmoothLineEnabled = false;
let closeActiveTagEditor = null;
let activeTrendRenderer = null;
let activeTrendId = "";
let printRestoreState = null;
let printRenderTablesOnly = false;
const trendCurveTension = 0.4;
