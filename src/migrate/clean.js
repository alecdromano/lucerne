const crypto = require("node:crypto");

function titleCase(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/(?:^|\s|-|\/)[a-z]/g, (match) => match.toUpperCase())
        .trim();
}

function cleanName(rawName) {
    const normalized = String(rawName || "").trim().split(/\s+/).join(" ");
    if (normalized.length < 3) return ["Unidentified", "Unidentified"];

    const lowered = normalized.toLowerCase();
    if (/\b(test|unknown|null|none|n\/?a|cash|walk\s*-?\s*in)\b/i.test(lowered)) {
        return ["Unidentified", "Unidentified"];
    }

    if (/\d/.test(normalized)) return ["Unidentified", "Unidentified"];

    const parts = normalized
        .split(" ")
        .map((part) => part.replace(/[^A-Za-z'-]/g, ""))
        .filter(Boolean);

    if (!parts.length) return ["Unidentified", "Unidentified"];
    if (parts.length === 1) return ["Unidentified", titleCase(parts[0])];
    return [titleCase(parts[1]), titleCase(parts[0])];
}

function formatPhone(rawPhone) {
    let digits = String(rawPhone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    if (digits.length !== 10) return "";
    return `+1${digits}`;
}

function cleanEmail(rawEmail) {
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email) return "";
    return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(email) ? email : "";
}

function cleanZip(rawZip) {
    const digits = String(rawZip || "").replace(/\D/g, "");
    if (digits.length === 5) return digits;
    if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return "";
}

function truthyTaxExempt(raw) {
    const value = String(raw || "").trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(value)) return "TRUE";
    if (["false", "0", "no", "n"].includes(value)) return "FALSE";
    return "";
}

const ADDRESS_STREET_PATTERN = /^(?:\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?\s+(?:[A-Za-z0-9][A-Za-z0-9.'/-]*\s*){1,}|P\.?(?:\s*O\.?)?\s*Box\s+\d+[A-Za-z0-9-]*)(?:\s+(?:Apt|Apartment|Unit|Ste|Suite|#)\s*[A-Za-z0-9-]+)?$/i;
const ADDRESS_SECONDARY_PATTERN = /^(?:(?:Apt|Apartment|Unit|Ste|Suite|#)\s*[A-Za-z0-9-]+)$/i;

function normalizeAddressCase(value) {
    let normalized = String(value || "").trim().split(/\s+/).join(" ");
    if (!normalized) return "";
    if (/^p\.?(?:\s*o\.?)?\s*box\b/i.test(normalized)) {
        return normalized.replace(/^p\.?(?:\s*o\.?)?\s*box/i, "PO Box").replace(/\s+/g, " ");
    }
    return titleCase(normalized);
}

function cleanAddress(rawAddress, allowSecondary = false) {
    const normalized = String(rawAddress || "").trim().split(/\s+/).join(" ");
    if (normalized.length < 5) return "";
    if (ADDRESS_STREET_PATTERN.test(normalized)) return normalizeAddressCase(normalized);
    if (allowSecondary && ADDRESS_SECONDARY_PATTERN.test(normalized)) return normalizeAddressCase(normalized);
    return "";
}

function parseTssIds(raw) {
    let cleaned = String(raw || "").trim();
    if (!cleaned) return [];
    if (cleaned.startsWith("[")) cleaned = cleaned.slice(1);
    if (cleaned.endsWith("]")) cleaned = cleaned.slice(0, -1);
    const out = [];
    for (const part of cleaned.split(",")) {
        const val = part.trim();
        if (val && !out.includes(val)) out.push(val);
    }
    return out;
}

function formatTssIds(ids) {
    const values = [];
    for (const raw of ids || []) {
        const val = String(raw || "").trim();
        if (val && !values.includes(val)) values.push(val);
    }
    return values.length ? `[${values.join(",")}]` : "";
}

function buildDeduplicatedCustomerId(rawTssIds) {
    const ids = parseTssIds(rawTssIds);
    if (!ids.length) return "";
    const canonical = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b))
        .join("|");
    const digest = crypto.createHash("md5").update(canonical).digest("hex").slice(0, 20);
    return `luc${digest}`;
}

function buildDeduplicatedVehicleId(rawIds) {
    const ids = [...new Set((rawIds || []).map((id) => String(id || "").trim()).filter((id) => id && id !== "0"))];
    if (!ids.length) return "";
    const canonical = ids.sort((a, b) => a.localeCompare(b)).join("|");
    const digest = crypto.createHash("md5").update(canonical).digest("hex").slice(0, 20);
    return `lucv${digest}`;
}

function formatGeneratedNote(generatedText, originalText = "") {
    const generated = String(generatedText || "").trim();
    const original = String(originalText || "").trim();
    if (!generated) return original;
    const wrapped = `{LUCERNE | ${generated}}`;
    return original ? `${wrapped} ${original}` : wrapped;
}

function sanitizeVehicleYear(rawYear) {
    const value = String(rawYear || "").trim();
    if (!value) return "";
    const currentYear = new Date().getFullYear() + 1;
    const validYear = (text) => /^\d{4}$/.test(text) && Number(text) >= 1900 && Number(text) <= currentYear;

    if (validYear(value)) return value;
    const m = value.match(/^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/);
    if (m && validYear(m[1])) return m[1];
    return "";
}

function sanitizeVehicleColor(rawColor) {
    const value = String(rawColor || "").trim().replace(/\s+/g, " ");
    if (!value) return "";
    const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!normalized || ["n a", "na", "none", "unknown", "unk", "0"].includes(normalized)) return "";

    const rules = [
        [/\b(black|blk|bk|charcoal)\b/, "Black"],
        [/\b(white|wht|wh|ivory|cream|pearl)\b/, "White"],
        [/\b(gray|grey|gry|gy|graphite)\b/, "Gray"],
        [/\b(silver|sil|slv)\b/, "Silver"],
        [/\b(blue|blu|navy)\b/, "Blue"],
        [/\b(red|burgundy|maroon|wine)\b/, "Red"],
        [/\b(green|grn)\b/, "Green"],
        [/\b(gold|gld)\b/, "Gold"],
        [/\b(yellow|ylw)\b/, "Yellow"],
        [/\b(orange|org)\b/, "Orange"],
        [/\b(brown|brn|tan|beige)\b/, "Brown"],
        [/\b(purple|pur|violet)\b/, "Purple"],
    ];

    for (const [pattern, color] of rules) {
        if (pattern.test(normalized)) return color;
    }
    return "";
}

module.exports = {
    titleCase,
    cleanName,
    formatPhone,
    cleanEmail,
    cleanZip,
    truthyTaxExempt,
    cleanAddress,
    parseTssIds,
    formatTssIds,
    buildDeduplicatedCustomerId,
    buildDeduplicatedVehicleId,
    formatGeneratedNote,
    sanitizeVehicleYear,
    sanitizeVehicleColor,
};
