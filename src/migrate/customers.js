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

const {
    getRecordMeta,
    setsOverlap,
    mergeCustomerRecord,
} = require("./merge.js");

function buildCustomerRow(sourceRow, columns) {
    const [firstName, lastName] = cleanName(sourceRow.NAME);
    const phoneCandidates = [
        formatPhone(sourceRow.HOME_PHONE),
        formatPhone(sourceRow.WORK_PHONE),
        formatPhone(sourceRow.FAX_PHONE),
        formatPhone(sourceRow.CELL_PHONE),
    ];
    const uniquePhones = [];
    for (const p of phoneCandidates) {
        if (p && !uniquePhones.includes(p)) uniquePhones.push(p);
    }

    const row = Object.fromEntries(columns.map((c) => [c, ""]));
    row["First Name*"] = firstName;
    row["Last Name*"] = lastName;
    row["Primary Phone (optional)"] = uniquePhones[0] || "";
    row["Additional Phones (optional)"] = uniquePhones.length > 1 ? uniquePhones.slice(1).join(", ") : "";
    row["Primary Email (optional)"] = cleanEmail(sourceRow.EMAIL_ADDR);
    row["Company Name (optional)"] = titleCase(sourceRow.COMP_NAME);
    row["Address 1 (optional)"] = cleanAddress(sourceRow.ADDRESS);
    row["Address 2 (optional)"] = cleanAddress(sourceRow.ADDRESS2, true);
    row["City (optional)"] = titleCase(sourceRow.CITY);
    row["State (optional)"] = String(sourceRow.STATE || "").trim().toUpperCase();
    row["Zip Code (optional)"] = cleanZip(sourceRow.ZIP);
    row["Country (optional)"] = "United States";
    row["Tax Exempt (optional)"] = truthyTaxExempt(sourceRow.TAX_EXEMPT);
    row.Tags = "TSS";
    row["TSS ID"] = formatTssIds([String(sourceRow.ID || "").trim()]);
    return row;
}

function isCompatible(existing, incoming) {
    const fields = [
        "First Name*",
        "Last Name*",
        "Primary Email (optional)",
        "Address 1 (optional)",
        "Address 2 (optional)",
        "City (optional)",
        "State (optional)",
        "Zip Code (optional)",
        "Company Name (optional)",
    ];
    for (const field of fields) {
        const left = existing[field] || "";
        const right = incoming[field] || "";
        if (left && right && left !== right) return false;
    }
    const leftMeta = getRecordMeta(existing);
    const rightMeta = getRecordMeta(incoming);
    if (leftMeta.phoneSet.size && rightMeta.phoneSet.size) {
        if (!setsOverlap(leftMeta.phoneSet, rightMeta.phoneSet)) return false;
    }
    return true;
}

function overlapScore(existing, incoming) {
    const fields = [
        "First Name*",
        "Last Name*",
        "Primary Phone (optional)",
        "Primary Email (optional)",
        "Address 1 (optional)",
        "City (optional)",
        "State (optional)",
        "Zip Code (optional)",
    ];
    let score = 0;
    for (const field of fields) {
        if (existing[field] && existing[field] === incoming[field]) score += 1;
    }
    const leftMeta = getRecordMeta(existing);
    const rightMeta = getRecordMeta(incoming);
    if (leftMeta.phoneSet.size && rightMeta.phoneSet.size && setsOverlap(leftMeta.phoneSet, rightMeta.phoneSet)) score += 2;
    if (existing["Primary Email (optional)"] && existing["Primary Email (optional)"] === incoming["Primary Email (optional)"]) score += 2;
    return score;
}

class CustomerDeduper {
    constructor() {
        this.records = [];
        this.byPhone = new Map();
        this.byEmail = new Map();
        this.byName = new Map();
        this.byAddress = new Map();
    }

    collectCandidates(incoming) {
        const candidates = new Set();
        const meta = getRecordMeta(incoming);
        for (const p of meta.phones) {
            const set = this.byPhone.get(p);
            if (set) for (const idx of set) candidates.add(idx);
        }
        if (meta.email) {
            const set = this.byEmail.get(meta.email);
            if (set) for (const idx of set) candidates.add(idx);
        }
        if (meta.hasName) {
            const set = this.byName.get(meta.nameKey);
            if (set) for (const idx of set) candidates.add(idx);
        }
        if (meta.hasAddress) {
            const set = this.byAddress.get(meta.addressKey);
            if (set) for (const idx of set) candidates.add(idx);
        }
        return candidates;
    }

    indexRecord(index, row) {
        const meta = getRecordMeta(row);
        for (const p of meta.phones) {
            if (!this.byPhone.has(p)) this.byPhone.set(p, new Set());
            this.byPhone.get(p).add(index);
        }
        if (meta.email) {
            if (!this.byEmail.has(meta.email)) this.byEmail.set(meta.email, new Set());
            this.byEmail.get(meta.email).add(index);
        }
        if (meta.hasName) {
            if (!this.byName.has(meta.nameKey)) this.byName.set(meta.nameKey, new Set());
            this.byName.get(meta.nameKey).add(index);
        }
        if (meta.hasAddress) {
            if (!this.byAddress.has(meta.addressKey)) this.byAddress.set(meta.addressKey, new Set());
            this.byAddress.get(meta.addressKey).add(index);
        }
    }

    removeIndex(index, row) {
        const rem = (map, key) => {
            const set = map.get(key);
            if (!set) return;
            set.delete(index);
            if (!set.size) map.delete(key);
        };
        const meta = getRecordMeta(row);
        for (const p of meta.phones) rem(this.byPhone, p);
        if (meta.email) rem(this.byEmail, meta.email);
        if (meta.hasName) rem(this.byName, meta.nameKey);
        if (meta.hasAddress) rem(this.byAddress, meta.addressKey);
    }

    add(incoming) {
        const candidates = this.collectCandidates(incoming);
        let bestIndex = null;
        let bestScore = 0;
        for (const idx of candidates) {
            const candidate = this.records[idx];
            if (!isCompatible(candidate, incoming)) continue;
            const score = overlapScore(candidate, incoming);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = idx;
            }
        }

        if (bestIndex == null) {
            this.records.push(incoming);
            this.indexRecord(this.records.length - 1, incoming);
            return;
        }

        const existing = this.records[bestIndex];
        this.removeIndex(bestIndex, existing);
        const merged = mergeCustomerRecord(existing, incoming);
        this.records[bestIndex] = merged;
        this.indexRecord(bestIndex, merged);
    }
}

function collapseUnidentified(records) {
    const identified = [];
    const unidentifiedIds = [];

    for (const rec of records) {
        const first = rec["First Name*"] || "";
        const last = rec["Last Name*"] || "";
        if (first === "Unidentified" && last === "Unidentified") {
            for (const id of parseTssIds(rec["TSS ID"])) {
                if (!unidentifiedIds.includes(id)) unidentifiedIds.push(id);
            }
        } else {
            identified.push(rec);
        }
    }

    if (unidentifiedIds.length) {
        const placeholder = Object.fromEntries(Object.keys(records[0] || {}).map((k) => [k, ""]));
        placeholder["First Name*"] = "Unidentified";
        placeholder["Last Name*"] = "Unidentified";
        placeholder.Tags = "TSS";
        placeholder["Country (optional)"] = "United States";
        placeholder["TSS ID"] = formatTssIds(unidentifiedIds);
        identified.push(placeholder);
    }

    return identified;
}

function applyCustomerNotes(records, timestamp = new Date()) {
    const noteDate = timestamp.toISOString().slice(0, 10);
    return records.map((rec) => {
        const copy = { ...rec };
        const ids = parseTssIds(copy["TSS ID"]);
        const idText = formatTssIds(ids);
        const lucerneId = buildDeduplicatedCustomerId(copy["TSS ID"]);
        copy["Lucerne ID"] = lucerneId;
        const generated = `Migrated from TSS XP on ${noteDate} from TSS customer record(s): ${idText}.`;
        copy["Note (optional)"] = formatGeneratedNote(generated, copy["Note (optional)"]);
        return copy;
    });
}

module.exports = {
    CustomerDeduper,
    buildCustomerRow,
    collapseUnidentified,
    applyCustomerNotes,
};
