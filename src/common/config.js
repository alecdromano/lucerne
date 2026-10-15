const fs = require("node:fs");
const path = require("node:path");
const { parseArgs } = require("node:util");
const { readJsonFile } = require("./util.js");

function resolvePath(filePath, baseDir = process.cwd()) {
    if (!filePath) return null;
    return path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
}

function parseCli() {
    const rootDir = path.resolve(__dirname, "../..");
    const configPath = path.join(rootDir, "config", "default.json");
    const defaultCfg = readJsonFile(configPath, { input: {}, output: {}, defaults: {} });

    const parsed = parseArgs({
        args: process.argv.slice(2),
        options: {
            "max-orders": { type: "string" },
            "max-rows": { type: "string" },
            "split-every": { type: "string" },
            "progress-every": { type: "string" },
            "no-progress": { type: "boolean", default: false },
            "no-migrate": { type: "boolean", default: false },
            "nomigrate": { type: "boolean", default: false },
            "targets": { type: "string" },
        },
        allowPositionals: true,
        strict: false,
    });

    const values = parsed.values;
    const defaultInputs = defaultCfg.input || {};
    const defaultOutputs = defaultCfg.output || {};

    const inputCustomers = resolvePath(defaultInputs.customers, rootDir);
    const inputVehicles = resolvePath(defaultInputs.vehicles, rootDir);
    const inputOrders = resolvePath(defaultInputs.orders, rootDir);
    const inputOrderItems = resolvePath(defaultInputs.lineitems, rootDir);
    const inputCommittedItems = resolvePath(defaultInputs.committed, rootDir);
    const inputDeposits = resolvePath(defaultInputs.deposits, rootDir);
    const inputDrawer = resolvePath(defaultInputs.drawer, rootDir);
    const inputInventory = resolvePath(defaultInputs.inventory, rootDir);

    const outDir = resolvePath(defaultOutputs.dir || "output", rootDir);
    const outputTarget = path.join(outDir, defaultOutputs.filename || "archive.html");

    const maxOrders = values["max-orders"] ? Number.parseInt(values["max-orders"], 10) : null;
    const maxRows = values["max-rows"] ? Number.parseInt(values["max-rows"], 10) : null;
    const splitEvery = values["split-every"]
        ? Number.parseInt(values["split-every"], 10)
        : (defaultCfg.defaults?.splitEvery ?? 0);
    const progressEvery = values["progress-every"]
        ? Number.parseInt(values["progress-every"], 10)
        : (defaultCfg.defaults?.progressEvery || 500);
    const showProgress = values["no-progress"]
        ? false
        : (defaultCfg.defaults?.showProgress ?? true);
    const nomigrate = Boolean(values["no-migrate"] || values.nomigrate);
    const rawTargets = values.targets
        ? String(values.targets).split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
        : null;

    return {
        inputCustomers,
        inputVehicles,
        inputOrders,
        inputOrderItems,
        inputCommittedItems,
        inputDeposits,
        inputDrawer,
        inputInventory,
        output: outputTarget,
        maxOrders,
        maxRows,
        splitEvery,
        progressEvery,
        showProgress,
        nomigrate,
        targets: rawTargets,
    };
}

module.exports = {
    parseCli,
    resolvePath,
};
