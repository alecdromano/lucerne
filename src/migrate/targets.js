const path = require("node:path");
const { readJsonFile } = require("../common/util.js");
const { runExport } = require("./run.js");

function getTargetSchemaPath(targetId, rootDir = path.resolve(__dirname, "../..")) {
    return path.join(rootDir, "config", "targets", `${targetId}.json`);
}

function hasConfiguredSchema(targetId, rootDir = path.resolve(__dirname, "../..")) {
    const schemaPath = getTargetSchemaPath(targetId, rootDir);
    const schema = readJsonFile(schemaPath, null);
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
        return false;
    }
    const entries = Object.values(schema);
    if (entries.length === 0) {
        return false;
    }
    return entries.some((fields) => Array.isArray(fields) && fields.length > 0);
}

function createTarget(id, name, description, filenamePrefix = id) {
    return {
        id,
        name,
        description,
        filenamePrefix,
        isConfigured: function(rootDir = path.resolve(__dirname, "../..")) {
            return hasConfiguredSchema(this.id, rootDir);
        },
        run: async function(options, sharedNhtsaIndex = null) {
            return runExport(options, this, sharedNhtsaIndex);
        },
    };
}

const shopmonkey = createTarget(
    "shopmonkey",
    "Shopmonkey",
    "Shopmonkey-formatted spreadsheets (Customers, Vehicles, Inventory, Orders, Line Items)"
);

const tekmetric = createTarget(
    "tekmetric",
    "Tekmetric",
    "Tekmetric-formatted spreadsheets (Customers, Vehicles, Inventory, Orders, Line Items)"
);

const shopware = createTarget(
    "shopware",
    "Shop-Ware",
    "Shop-Ware-formatted spreadsheets (Customers, Vehicles, Inventory, Orders, Line Items)"
);

const TARGETS = {
    [shopmonkey.id]: shopmonkey,
    [tekmetric.id]: tekmetric,
    [shopware.id]: shopware,
};

function getTarget(id) {
    return TARGETS[id] || null;
}

function listTargets() {
    return Object.values(TARGETS);
}

function listConfiguredTargets(rootDir = path.resolve(__dirname, "../..")) {
    return Object.values(TARGETS).filter((target) => target.isConfigured(rootDir));
}

module.exports = {
    TARGETS,
    getTarget,
    listTargets,
    listConfiguredTargets,
    hasConfiguredSchema,
    shopmonkey,
    tekmetric,
    shopware,
};
