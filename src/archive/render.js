const fs = require("node:fs");
const path = require("node:path");

const { getChartJsBundle, getBulmaCss, getClientStyles, getClientAppScript } = require("./bundle.js");

function getClientHtmlBody() {
    const htmlPath = path.resolve(__dirname, "../../client/index.html");
    return fs.readFileSync(htmlPath, "utf8");
}

function renderHtml(payload) {
    const chartJsBundle = getChartJsBundle();
    const bulmaCss = getBulmaCss();
    const clientStyles = getClientStyles();
    const clientBody = getClientHtmlBody();
    const clientAppScript = getClientAppScript();

    const payloadJson = JSON.stringify(payload).replace(/</g, "\\u003c");

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>TSS Archive</title>
    <style>
/* --- Bulma CSS Framework --- */
${bulmaCss}
/* --- Lucerne Application Styles --- */
${clientStyles}
    </style>
</head>
<body>
${clientBody}
    <script>${chartJsBundle}</script>
    <script id="payload" type="application/json">${payloadJson}</script>
    <script>
${clientAppScript}
    </script>
</body>
</html>`;
}

module.exports = {
    renderHtml,
};
