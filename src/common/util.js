const fs = require("node:fs");
const path = require("node:path");

function formatTimestamp(date = new Date()) {
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hour = String(date.getHours()).padStart(2, "0");
    const minute = String(date.getMinutes()).padStart(2, "0");
    const second = String(date.getSeconds()).padStart(2, "0");
    return `${year}${month}${day}_${hour}${minute}${second}`;
}

function formatDisplayDate(dateInput) {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(date.getTime())) return "";
    const datePart = date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
    const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${datePart} ${timePart}`;
}

function formatBytes(bytes) {
    const numeric = Number(bytes);
    if (!Number.isFinite(numeric) || numeric <= 0) return "0 B";
    if (numeric >= 1024 * 1024 * 1024) return `${(numeric / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (numeric >= 1024 * 1024) return `${(numeric / (1024 * 1024)).toFixed(2)} MB`;
    if (numeric >= 1024) return `${(numeric / 1024).toFixed(1)} KB`;
    return `${numeric} B`;
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (!minutes) return `${seconds}s`;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function nonEmptyString(value) {
    return String(value ?? "").trim();
}

function readJsonFile(filePath, fallback = {}) {
    try {
        if (!fs.existsSync(filePath)) return fallback;
        const text = fs.readFileSync(filePath, "utf8");
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

function writeJsonFile(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

module.exports = {
    formatTimestamp,
    formatDisplayDate,
    formatBytes,
    formatDuration,
    nonEmptyString,
    readJsonFile,
    writeJsonFile,
};
