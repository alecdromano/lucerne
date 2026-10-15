function loadUiState() {
    if (!supportsLocalStorage()) return;
    try {
        const raw = window.localStorage.getItem(STORAGE_UI_KEY);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (state && typeof state === "object") {
            if (typeof state.filterDateFrom === "string") filterDateFrom.value = state.filterDateFrom;
            if (typeof state.filterDateTo === "string") filterDateTo.value = state.filterDateTo;
            clampOutliersEnabled = typeof state.clampOutliersEnabled === "boolean"
                ? state.clampOutliersEnabled
                : (typeof state.clampTrendOutliers === "boolean" ? state.clampTrendOutliers : true);
            if (typeof state.search === "string") search.value = state.search;

            if (typeof state.sortBy === "string") sortBy.value = state.sortBy === "date" ? "invoiceDate" : state.sortBy;
            if (typeof state.sortDir === "string") sortDir.value = state.sortDir;
            if (typeof state.includePosted === "boolean") includePosted = state.includePosted;
            if (typeof state.includeUnposted === "boolean") includeUnposted = state.includeUnposted;
            if (typeof state.includeVoided === "boolean") includeVoided = state.includeVoided;
            if (typeof state.includeBlankStatus === "boolean") includeBlankStatus = state.includeBlankStatus;
            if (typeof state.includeSettled === "boolean") includePosted = state.includeSettled;
            if (typeof state.includeUnsettled === "boolean") includeUnposted = state.includeUnsettled;
            if (typeof state.requireMarked === "boolean") requireMarked = state.requireMarked;
            if (typeof state.requirePayments === "boolean") requirePayments = state.requirePayments;
            if (typeof state.requireDeposit === "boolean") requireDeposit = state.requireDeposit;
            if (typeof state.requireBalanceDue === "boolean") requireBalanceDue = state.requireBalanceDue;
            if (typeof state.requireFullyPaid === "boolean") requireFullyPaid = state.requireFullyPaid;
            if (typeof state.requireMostlyPaid === "boolean") requireMostlyPaid = state.requireMostlyPaid;
            if (typeof state.requireLabor === "boolean") requireLabor = state.requireLabor;
            if (typeof state.requireLaborDuration === "boolean") requireLaborDuration = state.requireLaborDuration;
            if (typeof state.excludeEdgeMonths === "boolean") excludeEdgeMonths = state.excludeEdgeMonths;
            if (Number.isFinite(Number(state.trendClampIqrMultiplier))) {
                trendClampIqrMultiplier = normalizeTrendClampMultiplier(state.trendClampIqrMultiplier);
                if (trendClampIqrMultiplier > 0) trendClampLastNonZero = trendClampIqrMultiplier;
            } else if (typeof state.clampTrendOutliers === "boolean") {
                trendClampIqrMultiplier = state.clampTrendOutliers ? 1.5 : 0;
                if (trendClampIqrMultiplier > 0) trendClampLastNonZero = trendClampIqrMultiplier;
            } else if (typeof state.clampGrossProfitOutliers === "boolean") {
                trendClampIqrMultiplier = state.clampGrossProfitOutliers ? 1.5 : 0;
                if (trendClampIqrMultiplier > 0) trendClampLastNonZero = trendClampIqrMultiplier;
            }
            if (Array.isArray(state.selectedSalespeople)) {
                selectedSalespeople = new Set(state.selectedSalespeople.map(function(value) { return normalizeSalespersonKey(value); }).filter(Boolean));
            }
            if (Array.isArray(state.selectedCustomTags)) {
                selectedCustomTags = new Set(state.selectedCustomTags.map(function(value) { return normalizeTagKey(value); }).filter(Boolean));
            }
        }
    } catch {
        // Ignore malformed stored state and continue with defaults.
    }
}

function saveUiState() {
    if (!supportsLocalStorage()) return;
    const state = {
        search: search.value || "",
        filterDateFrom: filterDateFrom.value || "",
        filterDateTo: filterDateTo.value || "",
        sortBy: sortBy.value || "invoiceDate",
        sortDir: sortDir.value || "desc",
        includePosted,
        includeUnposted,
        includeVoided,
        includeBlankStatus,
        requireMarked,
        requirePayments,
        requireDeposit,
        requireBalanceDue,
        requireFullyPaid,
        requireMostlyPaid,
        requireLabor,
        requireLaborDuration,
        excludeEdgeMonths,
        trendClampIqrMultiplier,
        clampOutliersEnabled,
        clampTrendOutliers: trendClampIqrMultiplier > 0,
        selectedSalespeople: Array.from(selectedSalespeople),
        selectedCustomTags: Array.from(selectedCustomTags),
    };
    try {
        window.localStorage.setItem(STORAGE_UI_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage write failures.
    }
}

function loadMarkedInvoices() {
    if (!supportsLocalStorage()) return;
    try {
        const raw = window.localStorage.getItem(STORAGE_MARKED_KEY);
        if (!raw) return;
        const values = JSON.parse(raw);
        if (!Array.isArray(values)) return;
        markedInvoiceNumbers = new Set(values.map(function(value) { return String(value || "").trim(); }).filter(Boolean));
    } catch {
        // Ignore malformed marked list and continue.
    }
}

function saveMarkedInvoices() {
    if (!supportsLocalStorage()) return;
    try {
        window.localStorage.setItem(STORAGE_MARKED_KEY, JSON.stringify(Array.from(markedInvoiceNumbers)));
    } catch {
        // Ignore storage write failures.
    }
}

function loadOrderTags() {
    if (!supportsLocalStorage()) return;
    try {
        const raw = window.localStorage.getItem(STORAGE_ORDER_TAGS_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw);
        if (!stored || typeof stored !== "object") return;

        const next = new Map();
        for (const orderNumber of Object.keys(stored)) {
            const values = stored[orderNumber];
            if (!Array.isArray(values)) continue;
            const tags = new Set(values.map(normalizeTag).filter(Boolean));
            if (tags.size) next.set(orderNumber, tags);
        }
        orderTags = next;
    } catch {
        // Ignore malformed tag store and continue.
    }
}

function saveOrderTags() {
    if (!supportsLocalStorage()) return;
    try {
        const obj = {};
        for (const [orderNumber, tags] of orderTags.entries()) {
            const list = Array.from(tags).map(normalizeTag).filter(Boolean);
            if (list.length) obj[orderNumber] = list;
        }
        window.localStorage.setItem(STORAGE_ORDER_TAGS_KEY, JSON.stringify(obj));
    } catch {
        // Ignore storage write failures.
    }
}

function setInvoiceMarked(orderNumber, shouldMark) {
    if (!orderNumber) return;
    if (shouldMark) markedInvoiceNumbers.add(orderNumber);
    else markedInvoiceNumbers.delete(orderNumber);
    saveMarkedInvoices();
}

