function drawOverviewComparisonDonut(canvas, currentValues, totalValues, palette, innerColor, innerInactiveColor, trackColor) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const size = Math.max(120, Math.floor(rect.width || 0));
    if (!size) return;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const outerThickness = Math.max(10, Math.floor(size * 0.13));
    const innerThickness = Math.max(3, Math.floor(size * 0.045));
    const outerRadius = (size / 2) - (outerThickness / 2) - 2;
    const gap = Math.max(1, Math.floor(size * 0.008));
    const innerRadius = outerRadius - outerThickness - gap;

    const currentTotal = currentValues.reduce(function(sum, v) { return sum + Number(v || 0); }, 0);
    const grandTotal = totalValues.reduce(function(sum, v) { return sum + Number(v || 0); }, 0);

    drawRingSeries(ctx, centerX, centerY, outerRadius, outerThickness, totalValues, palette, trackColor);

    const activeValue = Math.max(0, Math.min(grandTotal, currentTotal));
    const inactiveValue = Math.max(0, grandTotal - activeValue);
    drawRingSeries(
        ctx,
        centerX,
        centerY,
        innerRadius,
        innerThickness,
        [activeValue, inactiveValue],
        [innerColor || "#00529b", innerInactiveColor || "#dfe8f2"],
        trackColor
    );

    ctx.fillStyle = "#2b4359";
    ctx.textAlign = "center";
    ctx.font = "700 22px Segoe UI, sans-serif";
    ctx.fillText(currentTotal.toLocaleString(), centerX, centerY - 2);
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.fillStyle = "#5b7489";
    ctx.fillText("of " + grandTotal.toLocaleString(), centerX, centerY + 20);
    ctx.textAlign = "left";
}

function buildRequiredAovSeries(aovSeries, inflationSeries, baselineOverride) {
    if (!Array.isArray(aovSeries) || !Array.isArray(inflationSeries) || !aovSeries.length || !inflationSeries.length) {
        return { values: [], hasSeries: false };
    }

    let baselineIndex = -1;
    for (let i = 0; i < aovSeries.length; i += 1) {
        const aov = Number(aovSeries[i]);
        const inflation = Number(inflationSeries[i]);
        if (Number.isFinite(aov) && aov > 0 && Number.isFinite(inflation) && inflation > 0) {
            baselineIndex = i;
            break;
        }
    }

    if (baselineIndex < 0) {
        return { values: inflationSeries.map(function() { return null; }), hasSeries: false };
    }

    const baselineAovOverride = Number(baselineOverride && baselineOverride.aov);
    const baselineInflationOverride = Number(baselineOverride && baselineOverride.inflation);
    const baselineAov = Number.isFinite(baselineAovOverride) && baselineAovOverride > 0
        ? baselineAovOverride
        : Number(aovSeries[baselineIndex]);
    const baselineInflation = Number.isFinite(baselineInflationOverride) && baselineInflationOverride > 0
        ? baselineInflationOverride
        : Number(inflationSeries[baselineIndex]);
    const values = inflationSeries.map(function(inflation) {
        const currentInflation = Number(inflation);
        if (!Number.isFinite(currentInflation) || currentInflation <= 0) return null;
        return Math.round(baselineAov * (baselineInflation / currentInflation));
    });

    return {
        values,
        hasSeries: values.some(function(v) { return Number.isFinite(v); }),
    };
}

function getFirstWindowBaseline(labels, aovSeries, inflationSeries, ratio, anchorRange) {
    if (!Array.isArray(labels) || !Array.isArray(aovSeries) || !Array.isArray(inflationSeries)) {
        return { startLabel: "", endLabel: "", aov: null, inflation: null, count: 0 };
    }

    const windowRatio = Math.min(0.5, Math.max(0.01, Number(ratio || 0.1)));
    const candidates = [];
    for (let i = 0; i < labels.length; i += 1) {
        const rawLabel = String(labels[i] || "").trim();
        const normalizedDate = /^\d{4}-\d{2}$/.test(rawLabel)
            ? (rawLabel + "-01")
            : rawLabel.slice(0, 10);
        const ts = Date.parse(normalizedDate + "T00:00:00Z");
        const aov = Number(aovSeries[i]);
        const inflation = Number(inflationSeries[i]);
        if (!Number.isFinite(ts) || !Number.isFinite(aov) || aov <= 0 || !Number.isFinite(inflation) || inflation <= 0) continue;
        candidates.push({ label: rawLabel, ts, aov, inflation });
    }

    if (!candidates.length) return { startLabel: "", endLabel: "", aov: null, inflation: null, count: 0 };

    const anchorStartTs = Number(anchorRange && anchorRange.startTs);
    const anchorEndTs = Number(anchorRange && anchorRange.endTs);
    const minTs = Number.isFinite(anchorStartTs) ? anchorStartTs : candidates[0].ts;
    const maxTs = Number.isFinite(anchorEndTs) ? anchorEndTs : candidates[candidates.length - 1].ts;
    const cutoffTs = minTs + ((maxTs - minTs) * windowRatio);
    let windowPoints = candidates.filter(function(point) { return point.ts <= cutoffTs; });

    if (!windowPoints.length) {
        if (Number.isFinite(anchorStartTs) || Number.isFinite(anchorEndTs)) {
            return { startLabel: "", endLabel: "", aov: null, inflation: null, count: 0 };
        }
        const fallbackCount = Math.max(1, Math.ceil(candidates.length * windowRatio));
        windowPoints = candidates.slice(0, fallbackCount);
    }

    let sumAov = 0;
    let sumInflation = 0;
    for (let i = 0; i < windowPoints.length; i += 1) {
        sumAov += windowPoints[i].aov;
        sumInflation += windowPoints[i].inflation;
    }

    return {
        startLabel: windowPoints[0].label,
        endLabel: windowPoints[windowPoints.length - 1].label,
        aov: Math.round(sumAov / windowPoints.length),
        inflation: sumInflation / windowPoints.length,
        count: windowPoints.length,
    };
}

function hasValidBaseline(baseline) {
    return !!baseline
        && Number.isFinite(Number(baseline.aov))
        && Number(baseline.aov) > 0
        && Number.isFinite(Number(baseline.inflation))
        && Number(baseline.inflation) > 0;
}

function buildGlobalSalesBaselines() {
    const byDay = new Map();
    for (let i = 0; i < orders.length; i += 1) {
        const order = orders[i] || {};

        const dateIso = String(order.invoiceDateIso || "");
        const dayKey = dateIso.length >= 10 ? dateIso.slice(0, 10) : dateIso;
        if (!dayKey) continue;
        const total = Number(order.totalAmount || parseAmountClient(order.total));
        const prev = Number(byDay.get(dayKey) || 0);
        byDay.set(dayKey, prev + (Number.isFinite(total) ? total : 0));
    }

    const dayKeys = Array.from(byDay.keys()).sort();
    const dayValues = dayKeys.map(function(dayKey) {
        return Math.round(Number(byDay.get(dayKey) || 0));
    });
    const dayInflation = dayKeys.map(function(dayKey) {
        const monthKey = dayKey.slice(0, 7);
        const value = Number(inflationByMonth[monthKey]);
        return Number.isFinite(value) ? value : null;
    });
    const dailyAnchorRange = {
        startTs: dayKeys.length ? Date.parse(dayKeys[0] + "T00:00:00Z") : NaN,
        endTs: dayKeys.length ? Date.parse(dayKeys[dayKeys.length - 1] + "T00:00:00Z") : NaN,
    };

    const byMonth = new Map();
    for (let i = 0; i < dayKeys.length; i += 1) {
        const monthKey = dayKeys[i].slice(0, 7);
        const prev = Number(byMonth.get(monthKey) || 0);
        byMonth.set(monthKey, prev + Number(dayValues[i] || 0));
    }
    const monthKeys = Array.from(byMonth.keys()).sort();
    const monthValues = monthKeys.map(function(monthKey) {
        return Math.round(Number(byMonth.get(monthKey) || 0));
    });
    const monthInflation = monthKeys.map(function(monthKey) {
        const value = Number(inflationByMonth[monthKey]);
        return Number.isFinite(value) ? value : null;
    });
    const monthlyAnchorRange = {
        startTs: monthKeys.length ? Date.parse(monthKeys[0] + "-01T00:00:00Z") : NaN,
        endTs: monthKeys.length ? Date.parse(monthKeys[monthKeys.length - 1] + "-01T00:00:00Z") : NaN,
    };

    return {
        daily: getFirstWindowBaseline(dayKeys, dayValues, dayInflation, 0.1, dailyAnchorRange),
        monthly: getFirstWindowBaseline(monthKeys, monthValues, monthInflation, 0.1, monthlyAnchorRange),
    };
}

const globalSalesBaselines = buildGlobalSalesBaselines();

