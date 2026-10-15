const fs = require("node:fs");
const path = require("node:path");

function getChartJsBundle() {
    const entryPath = require.resolve("chart.js");
    const packageDir = path.dirname(path.dirname(entryPath));
    const bundlePath = path.join(packageDir, "dist", "chart.umd.min.js");
    if (!fs.existsSync(bundlePath)) {
        throw new Error(`Chart.js bundle not found at ${bundlePath}`);
    }
    return fs.readFileSync(bundlePath, "utf8").replace(/<\/script/gi, "<\\/script");
}

function getBulmaCss() {
    const bulmaPath = require.resolve("bulma/css/bulma.min.css");
    if (!fs.existsSync(bulmaPath)) {
        throw new Error(`Bulma CSS bundle not found at ${bulmaPath}`);
    }
    return fs.readFileSync(bulmaPath, "utf8");
}

const STYLE_FILES = [
    "theme.css",
    "loading.css",
    "controls.css",
    "sidebar.css",
    "trends.css",
    "invoice.css",
    "details.css",
    "footer.css",
    "responsive.css",
    "print.css",
];

const SCRIPT_FILES = [
    "state.js",
    "theme.js",
    "clamp.js",
    "format.js",
    "charts.js",
    "canvas.js",
    "baselines.js",
    "data.js",
    "series.js",
    "metrics.js",
    "sales.js",
    "profit.js",
    "labor.js",
    "modal.js",
    "summary.js",
    "overview.js",
    "status.js",
    "storage.js",
    "tags.js",
    "tables.js",
    "details.js",
    "cards.js",
    "print.js",
    "sort.js",
    "filter.js",
    "listeners.js",
    "export.js",
    "init.js",
];

function getClientStyles() {
    const stylesDir = path.resolve(__dirname, "../../client/styles");
    let combinedCss = "";
    for (const file of STYLE_FILES) {
        const filePath = path.join(stylesDir, file);
        if (fs.existsSync(filePath)) {
            combinedCss += `\n/* === ${file} === */\n` + fs.readFileSync(filePath, "utf8");
        }
    }
    return combinedCss;
}

function getClientAppScript() {
    const scriptsDir = path.resolve(__dirname, "../../client/scripts");
    let combinedJs = "(function() {\n";
    for (const file of SCRIPT_FILES) {
        const filePath = path.join(scriptsDir, file);
        if (fs.existsSync(filePath)) {
            combinedJs += `\n// === ${file} ===\n` + fs.readFileSync(filePath, "utf8");
        }
    }
    combinedJs += "\n})();";
    return combinedJs;
}

module.exports = {
    getChartJsBundle,
    getBulmaCss,
    getClientStyles,
    getClientAppScript,
};
