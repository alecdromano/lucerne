function normalizeTrendClampMultiplier(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(4, Number(numeric.toFixed(2))));
}

function formatTrendClampLabel(multiplier) {
    const normalized = normalizeTrendClampMultiplier(multiplier);
    if (normalized <= 0) return "Off";
    return normalized.toFixed(2) + "x IQR";
}

function trendClampSliderToMultiplier(sliderValue) {
    const slider = normalizeTrendClampMultiplier(sliderValue);
    if (slider <= TREND_CLAMP_SLIDER_MIN) return 0;
    const inverse = (TREND_CLAMP_SLIDER_MAX + TREND_CLAMP_SLIDER_STEP) - slider;
    return normalizeTrendClampMultiplier(Math.max(TREND_CLAMP_SLIDER_STEP, inverse));
}

function trendClampMultiplierToSlider(multiplier) {
    const normalized = normalizeTrendClampMultiplier(multiplier);
    if (normalized <= 0) return TREND_CLAMP_SLIDER_MIN;
    const slider = (TREND_CLAMP_SLIDER_MAX + TREND_CLAMP_SLIDER_STEP) - normalized;
    return normalizeTrendClampMultiplier(Math.min(TREND_CLAMP_SLIDER_MAX, Math.max(TREND_CLAMP_SLIDER_STEP, slider)));
}

function quantile(sortedValues, p) {
    if (!sortedValues.length) return NaN;
    const position = (sortedValues.length - 1) * p;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sortedValues[lower];
    const ratio = position - lower;
    return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * ratio;
}

function clampSeriesOutliers(values) {
    if (!Array.isArray(values) || !values.length) return values;
    if (!clampOutliersEnabled) return values.slice();
    const clampMultiplier = normalizeTrendClampMultiplier(trendClampIqrMultiplier);
    if (clampMultiplier <= 0) return values.slice();

    const finite = values.filter(function(value) {
        return Number.isFinite(Number(value));
    }).map(function(value) {
        return Number(value);
    }).sort(function(a, b) {
        return a - b;
    });

    if (finite.length < 4) return values.slice();

    const q1 = quantile(finite, 0.25);
    const q3 = quantile(finite, 0.75);
    const iqr = q3 - q1;
    if (!Number.isFinite(iqr) || iqr <= 0) return values.slice();

    const lowerBound = q1 - (clampMultiplier * iqr);
    const upperBound = q3 + (clampMultiplier * iqr);

    return values.map(function(value) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return value;
        return Math.max(lowerBound, Math.min(upperBound, numeric));
    });
}

function renderTrendOptionState() {
    if (excludeEdgeMonthsToggle) excludeEdgeMonthsToggle.checked = !!excludeEdgeMonths;
    if (modalExcludeEdgeMonthsToggle) modalExcludeEdgeMonthsToggle.checked = !!excludeEdgeMonths;
    if (modalSmoothLineToggle) modalSmoothLineToggle.checked = !!modalSmoothLineEnabled;
    if (clampOutliersToggle) clampOutliersToggle.checked = !!clampOutliersEnabled;
    if (modalClampOutliersToggle) modalClampOutliersToggle.checked = !!clampOutliersEnabled;
    const clampMultiplier = normalizeTrendClampMultiplier(trendClampIqrMultiplier);
    if (trendClampRange) trendClampRange.value = String(trendClampMultiplierToSlider(clampMultiplier));
    if (modalTrendClampRange) modalTrendClampRange.value = String(trendClampMultiplierToSlider(clampMultiplier));
}

function getTrendSampleLimit(isThumb) {
    if (isThumb) return 56;
    return modalSmoothLineEnabled ? 56 : 240;
}

function hideLoadingOverlay() {
    if (!appLoading) return;
    appLoading.classList.add("is-hidden");
    window.setTimeout(function() {
        if (appLoading && appLoading.parentNode) appLoading.parentNode.removeChild(appLoading);
    }, 260);
}

function setAppBusy(nextBusy) {
    document.body.classList.toggle("app-busy", !!nextBusy);
}

function updateTrendClampState(nextValue) {
    const nextMultiplier = trendClampSliderToMultiplier(nextValue);
    if (nextMultiplier > 0) trendClampLastNonZero = nextMultiplier;
    trendClampIqrMultiplier = nextMultiplier;
    renderTrendOptionState();
    saveUiState();
    renderTrendCards();
    if (trendModal.classList.contains("is-open") && activeTrendRenderer) {
        window.requestAnimationFrame(function() {
            if (activeTrendRenderer) activeTrendRenderer();
        });
    }
}

function resetTrendClampToDefault() {
    clampOutliersEnabled = true;
    trendClampIqrMultiplier = TREND_CLAMP_DEFAULT;
    trendClampLastNonZero = TREND_CLAMP_DEFAULT;
    applyTrendControlChanges();
}

function applyTrendControlChanges() {
    renderTrendOptionState();
    saveUiState();
    renderTrendCards();
    if (trendModal.classList.contains("is-open") && activeTrendRenderer) {
        window.requestAnimationFrame(function() {
            if (activeTrendRenderer) activeTrendRenderer();
        });
    }
}

function setClampOutliersEnabled(nextEnabled) {
    clampOutliersEnabled = !!nextEnabled;
    if (clampOutliersEnabled) {
        if (normalizeTrendClampMultiplier(trendClampIqrMultiplier) <= 0) {
            const fallbackMultiplier = normalizeTrendClampMultiplier(trendClampLastNonZero || TREND_CLAMP_DEFAULT);
            trendClampIqrMultiplier = fallbackMultiplier > 0 ? fallbackMultiplier : TREND_CLAMP_DEFAULT;
        }
    } else if (normalizeTrendClampMultiplier(trendClampIqrMultiplier) > 0) {
        trendClampLastNonZero = normalizeTrendClampMultiplier(trendClampIqrMultiplier);
    }
    applyTrendControlChanges();
}

function setExcludeEdgeMonthsEnabled(nextEnabled) {
    excludeEdgeMonths = !!nextEnabled;
    applyTrendControlChanges();
}

