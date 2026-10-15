const fs = require("node:fs");
const path = require("node:path");

const { readCsvRows, countCsvRows } = require("../common/csv.js");
const { readJsonFile } = require("../common/util.js");
const { fetchLiveInflationSeries } = require("../fetch/cpi.js");
const { groupPaymentsByOrder, buildOrdersPayload } = require("./payload.js");
const { mergePaymentRows } = require("./payment.js");
const { buildInventoryCostLookup, enrichCommittedRowCosts, mergeCommittedItems, groupItemsByOrder } = require("./items.js");
const { renderHtml } = require("./render.js");

function collectSourceDataStats(options = {}, rootDir = path.resolve(__dirname, "../..")) {
    const sourcesConfig = readJsonFile(path.join(rootDir, "config", "sources.json"), []);
    const sourceFiles = [];

    for (const src of sourcesConfig) {
        const filePath = Object.hasOwn(options, src.optionKey)
            ? options[src.optionKey]
            : (src.defaultFile ? path.resolve(rootDir, src.defaultFile) : null);
        let rows = 0;
        let exists = false;
        if (filePath && fs.existsSync(filePath)) {
            exists = true;
            const count = countCsvRows(filePath);
            rows = typeof count === "number" ? count : 0;
        }
        sourceFiles.push({
            name: src.name,
            description: src.description,
            rows,
            exists,
        });
    }

    return {
        sourceFiles,
    };
}

async function runArchive(options = {}, migrationPackages = {}, preloadedInflation = null) {
    const rootDir = path.resolve(__dirname, "../..");
    const defaultCfg = readJsonFile(path.join(rootDir, "config", "default.json"), { defaults: {} });
    const cfgDefaults = defaultCfg.defaults || {};
    const fields = readJsonFile(path.join(rootDir, "config", "fields.json"));
    const mapping = readJsonFile(path.join(rootDir, "config", "mapping.json"));

    // 1. Read input rows
    const orderRows = readCsvRows(options.inputOrders, fields.order);
    const itemRows = readCsvRows(options.inputOrderItems, fields.item);

    let depositRows = [];
    if (options.inputDeposits && fs.existsSync(options.inputDeposits)) {
        depositRows = readCsvRows(options.inputDeposits, fields.payment);
    }
    let drawerRows = [];
    if (options.inputDrawer && fs.existsSync(options.inputDrawer)) {
        drawerRows = readCsvRows(options.inputDrawer, fields.payment);
    }
    const paymentRows = (drawerRows.length > 0 || depositRows.length > 0)
        ? mergePaymentRows(drawerRows, depositRows)
        : [];

    // 2. Fetch or resolve live inflation
    let inflationSeries = null;
    try {
        if (preloadedInflation !== null) {
            inflationSeries = await preloadedInflation;
        } else {
            inflationSeries = await fetchLiveInflationSeries();
        }
    } catch (err) {
        process.stderr.write(`Notice: Failed to fetch live FRED CPI data (${err.message}). Continuing without inflation adjustment.\n`);
    }

    // 3. Prepare order rows
    let renderOrders = orderRows;
    if (options.maxOrders != null && options.maxOrders > 0) {
        renderOrders = renderOrders.slice(0, options.maxOrders);
    }

    // 4. Group items & payments
    const itemsByOrder = groupItemsByOrder(itemRows);

    if (options.inputCommittedItems && fs.existsSync(options.inputCommittedItems)) {
        const committedRows = readCsvRows(options.inputCommittedItems, fields.item);
        if (options.inputInventory && fs.existsSync(options.inputInventory)) {
            const inventoryRows = readCsvRows(options.inputInventory, ["MODEL", "MAKE"]);
            const costLookup = buildInventoryCostLookup(inventoryRows);
            enrichCommittedRowCosts(committedRows, costLookup);
        } else {
            enrichCommittedRowCosts(committedRows, null);
        }
        mergeCommittedItems(itemsByOrder, committedRows);
    }

    const paymentsByOrder = groupPaymentsByOrder(paymentRows);

    // 5. Build renderable orders
    const ordersPayload = buildOrdersPayload(
        renderOrders,
        itemsByOrder,
        paymentsByOrder,
        mapping,
        cfgDefaults.includeEmptyFields ?? false
    );

    // 6. Assemble complete payload
    const dataStats = collectSourceDataStats(options);
    const chartsConfig = readJsonFile(path.join(rootDir, "config", "charts.json"));
    const payload = {
        generatedAt: new Date().toISOString(),
        orders: ordersPayload,
        inflation: inflationSeries,
        config: {
            overviewCharts: chartsConfig,
        },
        migrationPackages,
        dataStats,
        nomigrate: Boolean(options.nomigrate),
    };

    // 7. Render HTML
    const html = renderHtml(payload);

    // 8. Write output
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, html, "utf8");

    return {
        outputPath: options.output,
        orderCount: ordersPayload.length,
    };
}

module.exports = {
    runArchive,
    collectSourceDataStats,
};
