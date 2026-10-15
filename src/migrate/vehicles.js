const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
    parseTssIds,
    formatTssIds,
    buildDeduplicatedVehicleId,
    formatGeneratedNote,
    sanitizeVehicleYear,
    sanitizeVehicleColor,
} = require("./clean.js");
const {
    fetchLatestNhtsaReleaseInfo,
    downloadFileWithProgress,
    extractNhtsaZip,
} = require("../fetch/nhtsa.js");

function normalizeVehicleText(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

function parseNhtsaDump(sqlPath) {
    const index = {
        makeNameToIds: new Map(),
        modelNameToIds: new Map(),
        makeIdToName: new Map(),
        modelIdToName: new Map(),
        makeToModelIds: new Map(),
    };

    const lines = fs.readFileSync(sqlPath, "utf8").split(/\r?\n/);
    let currentTable = null;

    for (const line of lines) {
        if (line.startsWith("COPY vpic.")) {
            currentTable = null;
            if (line.startsWith("COPY vpic.make_model")) currentTable = "make_model";
            else if (line.startsWith("COPY vpic.make")) currentTable = "make";
            else if (line.startsWith("COPY vpic.model")) currentTable = "model";
            continue;
        }

        if (line === "\\.") {
            currentTable = null;
            continue;
        }
        if (!currentTable) continue;

        const parts = line.split("\t");
        try {
            if (currentTable === "make" && parts.length >= 2) {
                const makeId = Number.parseInt(parts[0], 10);
                const makeName = parts[1].trim();
                const key = normalizeVehicleText(makeName);
                if (key) {
                    if (!index.makeNameToIds.has(key)) index.makeNameToIds.set(key, []);
                    index.makeNameToIds.get(key).push(makeId);
                }
                index.makeIdToName.set(makeId, makeName);
            } else if (currentTable === "model" && parts.length >= 2) {
                const modelId = Number.parseInt(parts[0], 10);
                const modelName = parts[1].trim();
                const key = normalizeVehicleText(modelName);
                if (key) {
                    if (!index.modelNameToIds.has(key)) index.modelNameToIds.set(key, []);
                    index.modelNameToIds.get(key).push(modelId);
                }
                index.modelIdToName.set(modelId, modelName);
            } else if (currentTable === "make_model" && parts.length >= 3) {
                const makeId = Number.parseInt(parts[1], 10);
                const modelId = Number.parseInt(parts[2], 10);
                if (!index.makeToModelIds.has(makeId)) index.makeToModelIds.set(makeId, new Set());
                index.makeToModelIds.get(makeId).add(modelId);
            }
        } catch {
            // Skip malformed rows
        }
    }

    return index;
}

function matchNhtsaCandidates(rawMake, rawModel, index) {
    if (!index) return [];
    const makeKey = normalizeVehicleText(rawMake);
    const modelKey = normalizeVehicleText(rawModel);
    if (!makeKey || !modelKey) return [];

    const makeIds = index.makeNameToIds.get(makeKey) || [];
    const modelIds = index.modelNameToIds.get(modelKey) || [];
    if (!makeIds.length || !modelIds.length) return [];

    const candidates = [];
    for (const makeId of makeIds) {
        const validModels = index.makeToModelIds.get(makeId) || new Set();
        for (const modelId of modelIds) {
            if (!validModels.has(modelId)) continue;
            const makeName = index.makeIdToName.get(makeId);
            const modelName = index.modelIdToName.get(modelId);
            if (makeName && modelName) {
                candidates.push([makeId, makeName, modelId, modelName]);
            }
        }
    }
    return candidates;
}

async function ensureNhtsa(targetDir = null) {
    const tempDir = targetDir ? path.resolve(targetDir) : path.join(os.tmpdir(), "lucerne-nhtsa");
    fs.mkdirSync(tempDir, { recursive: true });

    process.stderr.write("Checking NHTSA website for latest vehicle database...\n");

    const releaseInfo = await fetchLatestNhtsaReleaseInfo();
    const expectedSqlPath = path.join(tempDir, releaseInfo.sqlFilename);

    if (fs.existsSync(expectedSqlPath) && fs.statSync(expectedSqlPath).size > 1024 * 1024) {
        return expectedSqlPath;
    }

    const tempZipPath = path.join(tempDir, `.temp_${releaseInfo.zipFilename}`);
    try {
        await downloadFileWithProgress(releaseInfo.zipUrl, tempZipPath);
        return await extractNhtsaZip(tempZipPath, tempDir, releaseInfo.sqlFilename);
    } finally {
        if (fs.existsSync(tempZipPath)) {
            try {
                fs.unlinkSync(tempZipPath);
            } catch {
                // Ignore cleanup error
            }
        }
    }
}

function buildOwnerMap(customers) {
    const out = new Map();
    for (const cust of customers || []) {
        const first = cust["First Name*"] || "";
        const last = cust["Last Name*"] || "";
        if (!first || !last) continue;
        const isUnidentified = first === "Unidentified" && last === "Unidentified";
        const owner = isUnidentified ? "" : `${first} ${last}`;
        const lucerneId = String(cust["Lucerne ID"] || "").trim();
        const tssIds = parseTssIds(cust["TSS ID"] || "");
        const tssIdText = isUnidentified ? "" : formatTssIds(tssIds);
        for (const id of tssIds) {
            out.set(id, { owner, lucerneId, tssIdText });
        }
    }
    return out;
}

function buildVehicleRow(columns, { make, model, year, color, ownerName, ownerId, vehicleId, noteText }) {
    const row = Object.fromEntries(columns.map((c) => [c, ""]));
    row["Year*"] = year;
    row["Make*"] = String(make || "").trim();
    row["Model*"] = String(model || "").trim();
    row["Color (optional)"] = color;
    row["Owners (optional)"] = ownerName;
    row["Note (optional)"] = formatGeneratedNote(noteText, row["Note (optional)"]);
    row["Owner Lucerne ID"] = ownerId || "";
    row["Lucerne ID"] = vehicleId || "";
    return row;
}

function buildVehicleMigrationNote(noteDate, row) {
    const details = [
        `year='${String(row.AUTO_YEAR || "").trim()}'`,
        `make='${String(row.AUTO_MAKE || "").trim()}'`,
        `model='${String(row.AUTO_MODEL || "").trim()}'`,
        `color='${String(row.COLOR || "").trim()}'`,
    ];
    return `Migrated from TSS XP on ${noteDate} from original vehicle strings: ${details.join(", ")}`;
}

function processVehicles(rows, customerRecords, nhtsaIndex, columns, timestamp = new Date(), onProgress = null) {
    const ownerMap = buildOwnerMap(customerRecords);
    const noteDate = timestamp.toISOString().slice(0, 10);
    const vehicleRecords = [];
    const vehicleIdLookup = new Map();

    for (const row of rows) {
        if (onProgress) onProgress();
        const tssId = String(row.ID || "").trim();
        const autoMake = String(row.AUTO_MAKE || "").trim();
        const autoModel = String(row.AUTO_MODEL || "").trim();
        const autoYearRaw = String(row.AUTO_YEAR || "").trim();
        const autoYear = sanitizeVehicleYear(autoYearRaw);
        const color = sanitizeVehicleColor(row.COLOR || "");
        const sourceVehicleIds = [row.ID, row.AUTO_ID, row.NEW_AUTO_ID];
        const lucerneVehicleId = buildDeduplicatedVehicleId(sourceVehicleIds);

        if (lucerneVehicleId) {
            for (const rawId of sourceVehicleIds) {
                const key = String(rawId || "").trim();
                if (key && key !== "0") {
                    vehicleIdLookup.set(key, lucerneVehicleId);
                }
            }
        }

        if (!autoMake && !autoModel && !autoYearRaw && !color) continue;
        if (!autoYear || !ownerMap.has(tssId)) continue;

        const candidates = matchNhtsaCandidates(autoMake, autoModel, nhtsaIndex);
        if (candidates.length) {
            const ownerInfo = ownerMap.get(tssId);
            const noteText = buildVehicleMigrationNote(noteDate, row);
            const vehicleData = {
                make: candidates[0][1],
                model: candidates[0][3],
                year: autoYear,
                color,
                ownerName: ownerInfo?.owner || "",
                ownerId: ownerInfo?.lucerneId || "",
                vehicleId: lucerneVehicleId,
                noteText,
            };
            vehicleRecords.push(buildVehicleRow(columns, vehicleData));
        }
    }

    return { vehicleRecords, vehicleIdLookup };
}

module.exports = {
    ensureNhtsa,
    parseNhtsaDump,
    matchNhtsaCandidates,
    normalizeVehicleText,
    sanitizeVehicleYear,
    sanitizeVehicleColor,
    buildOwnerMap,
    processVehicles,
};
