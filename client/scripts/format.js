function getOrderNumber(order) {
    return String((order && order.orderNumber) || "").trim();
}

function supportsLocalStorage() {
    try {
        return !!window.localStorage;
    } catch {
        return false;
    }
}

function applyTagVisual(buttonEl, isActive) {
    buttonEl.classList.toggle("is-active", isActive);
    buttonEl.setAttribute("aria-pressed", isActive ? "true" : "false");
}

function renderTagState() {
    tagPosted.checked = !!includePosted;
    tagUnposted.checked = !!includeUnposted;
    tagVoided.checked = !!includeVoided;
    tagBlankStatus.checked = !!includeBlankStatus;
    applyTagVisual(tagMarked, requireMarked);
    applyTagVisual(tagPayments, requirePayments);
    applyTagVisual(tagDeposits, requireDeposit);
    applyTagVisual(tagBalanceDue, requireBalanceDue);
    applyTagVisual(tagFullyPaid, requireFullyPaid);
    applyTagVisual(tagMostlyPaid, requireMostlyPaid);
    applyTagVisual(tagHasLabor, requireLabor);
    applyTagVisual(tagHasLaborDuration, requireLaborDuration);
}

function normalizeTag(value) {
    return String(value || "").trim();
}

function normalizeTagKey(value) {
    return normalizeTag(value).toLowerCase();
}

function normalizeSalesperson(value) {
    return String(value || "").trim();
}

function normalizeSalespersonKey(value) {
    return normalizeSalesperson(value).toLowerCase();
}

function getAllKnownSalespeople() {
    const byKey = new Map();
    for (let i = 0; i < orders.length; i += 1) {
        const raw = normalizeSalesperson(orders[i] && orders[i].salesperson);
        if (!raw) continue;
        const key = normalizeSalespersonKey(raw);
        if (!byKey.has(key)) byKey.set(key, raw);
    }
    return Array.from(byKey.values()).sort(function(a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
}

function getOrderTags(orderNumber) {
    const value = orderTags.get(orderNumber);
    return value instanceof Set ? value : new Set();
}

function getAllKnownTags() {
    const byKey = new Map();
    for (const tags of orderTags.values()) {
        for (const tag of tags) {
            const key = normalizeTagKey(tag);
            if (!key) continue;
            if (!byKey.has(key)) byKey.set(key, tag);
        }
    }
    return Array.from(byKey.values()).sort(function(a, b) {
        return a.localeCompare(b, undefined, { sensitivity: "base" });
    });
}

function setOrderTags(orderNumber, tagsSet) {
    if (!orderNumber) return;
    if (!tagsSet || !tagsSet.size) {
        orderTags.delete(orderNumber);
    } else {
        orderTags.set(orderNumber, new Set(tagsSet));
    }
}

function addOrderTag(orderNumber, tagValue) {
    const tag = normalizeTag(tagValue);
    if (!orderNumber || !tag) return false;
    const existing = getOrderTags(orderNumber);
    if (existing.size >= MAX_TAGS_PER_ORDER) return false;
    const key = normalizeTagKey(tag);
    for (const entry of existing) {
        if (normalizeTagKey(entry) === key) return false;
    }
    existing.add(tag);
    setOrderTags(orderNumber, existing);
    return true;
}

function removeOrderTag(orderNumber, tagValue) {
    const tagKey = normalizeTagKey(tagValue);
    if (!orderNumber || !tagKey) return false;
    const existing = getOrderTags(orderNumber);
    if (!existing.size) return false;
    let removed = false;
    const next = new Set();
    for (const entry of existing) {
        if (normalizeTagKey(entry) === tagKey) {
            removed = true;
        } else {
            next.add(entry);
        }
    }
    if (removed) setOrderTags(orderNumber, next);
    return removed;
}

function statusLabel(statusCode) {
    const code = String(statusCode || "").toUpperCase();
    if (code === "P") return "Posted";
    if (code === "S") return "Unposted";
    if (code === "V") return "Void";
    return "Other";
}

function getLastModifiedHeading(order) {
    const dateValue = String(order.lastActivityDate || order.transactionDate || order.invoiceDate || order.createdDate || "").trim() || "Unknown date";
    const timeValue = String(order.lastActivityTime || "").trim() || "Unknown time";
    return "Last modified on " + dateValue + " at " + timeValue;
}

function statusBucket(statusCode) {
    const code = String(statusCode || "").toUpperCase();
    if (code === "P") return "posted";
    if (code === "S") return "unposted";
    if (code === "V") return "voided";
    return "other";
}

function countStatusesByIndices(indices) {
    const counts = { posted: 0, unposted: 0, voided: 0, other: 0 };
    for (let i = 0; i < indices.length; i += 1) {
        const order = orders[indices[i]] || {};
        const bucket = statusBucket(order.statusCode);
        counts[bucket] += 1;
    }
    return counts;
}

function parseAmountClient(value) {
    const raw = String(value || "").trim();
    if (!raw) return 0;
    const normalized = raw.replace(/[$,\s]/g, "").replace(/[()]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

const currencyFieldLabels = new Set([
    "Materials",
    "Labor",
    "Sublet",
    "Other",
    "Misc",
    "Tax",
    "Subtotal",
    "Order Total",
    "Deposit",
    "Balance Due",
    "Paid Cash",
    "Paid Check",
    "Paid Card",
    "Paid Open",
    "Paid House",
]);

function isCurrencyFieldLabel(label) {
    const normalizedLabel = String(label || "").trim();
    return currencyFieldLabels.has(normalizedLabel) || normalizedLabel.startsWith("Paid ");
}

function formatCurrencyClient(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw || !/[0-9]/.test(raw)) return raw;
    const amount = parseAmountClient(raw);
    if (!Number.isFinite(amount)) return raw;
    const sign = amount < 0 ? "-" : "";
    return sign + "$" + Math.abs(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function formatCompact(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function clipLabels(labels, maxLabels) {
    if (labels.length <= maxLabels) return labels.map(function(_, i) { return i; });
    const step = Math.ceil(labels.length / maxLabels);
    const shown = [];
    for (let i = 0; i < labels.length; i += step) shown.push(i);
    if (shown[shown.length - 1] !== labels.length - 1) shown.push(labels.length - 1);
    return shown;
}

function downsampleSeries(labels, values, maxPoints) {
    const cap = Math.max(2, Number(maxPoints || 60));
    if (!Array.isArray(labels) || !Array.isArray(values) || labels.length <= cap || values.length <= cap) {
        return { labels: labels.slice(), values: values.slice() };
    }

    const sampledLabels = [];
    const sampledValues = [];
    const bucketSize = labels.length / cap;

    for (let b = 0; b < cap; b += 1) {
        const start = Math.floor(b * bucketSize);
        const end = Math.min(labels.length, Math.floor((b + 1) * bucketSize));
        if (start >= end) continue;

        let sum = 0;
        let count = 0;
        for (let i = start; i < end; i += 1) {
            sum += Number(values[i] || 0);
            count += 1;
        }

        sampledLabels.push(labels[end - 1]);
        sampledValues.push(count ? Math.round(sum / count) : 0);
    }

    return { labels: sampledLabels, values: sampledValues };
}

function formatDisplayDateClient(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "";
    const datePart = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
    const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${datePart} ${timePart}`;
}

