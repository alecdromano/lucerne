const COMPACT_NUMBER_FORMAT = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});

function formatCompactCount(value) {
    return COMPACT_NUMBER_FORMAT.format(Math.round(Math.max(0, Number(value) || 0)));
}

function formatSeconds(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const sec = total % 60;
    const totalMinutes = Math.floor(total / 60);
    const min = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);
    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    }
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

module.exports = {
    formatCompactCount,
    formatSeconds,
};
