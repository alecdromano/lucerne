const {
    cleanName,
    formatPhone,
    cleanEmail,
    cleanZip,
    truthyTaxExempt,
    cleanAddress,
    titleCase,
    formatTssIds,
    parseTssIds,
    buildDeduplicatedCustomerId,
    formatGeneratedNote,
} = require("./clean.js");

function splitValues(raw) {
    if (!raw) return [];
    return String(raw).split(",").map((p) => p.trim()).filter(Boolean);
}

function getRecordMeta(record) {
    const phones = [...new Set([
        ...splitValues(record["Primary Phone (optional)"]),
        ...splitValues(record["Additional Phones (optional)"]),
    ])];
    const phoneSet = new Set(phones);
    const email = record["Primary Email (optional)"] || "";
    const hasName = Boolean(record["First Name*"] || record["Last Name*"]);
    const nameKey = hasName ? `${record["First Name*"] || ""}|${record["Last Name*"] || ""}` : "";
    const hasAddress = ["Address 1 (optional)", "City (optional)", "State (optional)", "Zip Code (optional)"].some((f) => record[f]);
    const addressKey = hasAddress
        ? [record["Address 1 (optional)"] || "", record["City (optional)"] || "", record["State (optional)"] || "", record["Zip Code (optional)"] || ""].join("|")
        : "";
    return { phones, phoneSet, email, hasName, nameKey, hasAddress, addressKey };
}

function setsOverlap(left, right) {
    const [small, large] = left.size <= right.size ? [left, right] : [right, left];
    for (const val of small) {
        if (large.has(val)) return true;
    }
    return false;
}

function mergeScalar(existing, incoming, favorLonger = false) {
    if (!existing) return incoming;
    if (!incoming) return existing;
    if (existing === incoming) return existing;
    if (existing === "Unidentified" && incoming !== "Unidentified") return incoming;
    if (incoming === "Unidentified" && existing !== "Unidentified") return existing;
    if (favorLonger) return incoming.length > existing.length ? incoming : existing;
    return existing;
}

function mergeCustomerRecord(existing, incoming) {
    const merged = { ...existing };
    merged["First Name*"] = mergeScalar(existing["First Name*"], incoming["First Name*"]);
    merged["Last Name*"] = mergeScalar(existing["Last Name*"], incoming["Last Name*"]);
    merged["Primary Email (optional)"] = mergeScalar(existing["Primary Email (optional)"], incoming["Primary Email (optional)"]);
    merged["Company Name (optional)"] = mergeScalar(existing["Company Name (optional)"], incoming["Company Name (optional)"], true);
    merged["Address 1 (optional)"] = mergeScalar(existing["Address 1 (optional)"], incoming["Address 1 (optional)"], true);
    merged["Address 2 (optional)"] = mergeScalar(existing["Address 2 (optional)"], incoming["Address 2 (optional)"], true);
    merged["City (optional)"] = mergeScalar(existing["City (optional)"], incoming["City (optional)"]);
    merged["State (optional)"] = mergeScalar(existing["State (optional)"], incoming["State (optional)"]);
    merged["Zip Code (optional)"] = mergeScalar(existing["Zip Code (optional)"], incoming["Zip Code (optional)"]);
    merged["Tax Exempt (optional)"] = mergeScalar(existing["Tax Exempt (optional)"], incoming["Tax Exempt (optional)"]);

    const phones = [];
    for (const val of [existing["Primary Phone (optional)"], existing["Additional Phones (optional)"], incoming["Primary Phone (optional)"], incoming["Additional Phones (optional)"]]) {
        for (const phone of splitValues(val)) {
            if (!phones.includes(phone)) phones.push(phone);
        }
    }
    merged["Primary Phone (optional)"] = phones[0] || "";
    merged["Additional Phones (optional)"] = phones.length > 1 ? phones.slice(1).join(", ") : "";

    const ids = [];
    for (const raw of [existing["TSS ID"], incoming["TSS ID"]]) {
        for (const id of parseTssIds(raw)) {
            if (!ids.includes(id)) ids.push(id);
        }
    }
    merged["TSS ID"] = formatTssIds(ids);
    merged.Tags = "TSS";
    merged["Country (optional)"] = "United States";
    return merged;
}

module.exports = {
    splitValues,
    getRecordMeta,
    setsOverlap,
    mergeScalar,
    mergeCustomerRecord,
};
