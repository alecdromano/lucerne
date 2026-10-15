const fs = require("node:fs");
const path = require("node:path");
const iconv = require("iconv-lite");
const { parse } = require("csv-parse/sync");

const CSV_ENCODINGS = ["utf8", "win1252", "latin1"];
const CSV_ROW_COUNT_CACHE = new Map();

function detectCsvEncoding(filePath) {
    const data = fs.readFileSync(filePath);
    if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
        return "utf8";
    }
    try {
        const decoder = new TextDecoder("utf-8", { fatal: true });
        decoder.decode(data);
        return "utf8";
    } catch {
        return "win1252";
    }
}

function readCsvRows(filePath, requiredColumns = []) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`CSV file not found: ${filePath}`);
    }

    const encoding = detectCsvEncoding(filePath);
    const buffer = fs.readFileSync(filePath);
    const content = iconv.decode(buffer, encoding);

    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
    });

    CSV_ROW_COUNT_CACHE.set(path.resolve(filePath), records.length);

    if (requiredColumns.length > 0 && records.length > 0) {
        const firstRecord = records[0];
        const missing = requiredColumns.filter((col) => !Object.hasOwn(firstRecord, col));
        if (missing.length > 0) {
            throw new Error(`Missing required CSV column(s): ${missing.join(", ")} in ${filePath}`);
        }
    }

    return records;
}

function countCsvRows(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const resolved = path.resolve(filePath);
    if (CSV_ROW_COUNT_CACHE.has(resolved)) {
        return CSV_ROW_COUNT_CACHE.get(resolved);
    }
    try {
        const rows = readCsvRows(resolved);
        return rows.length;
    } catch {
        return null;
    }
}

module.exports = {
    detectCsvEncoding,
    readCsvRows,
    countCsvRows,
};
