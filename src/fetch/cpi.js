const https = require("node:https");
const { parse } = require("csv-parse/sync");

const FRED_CPI_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL";

function fetchText(url, redirectsLeft = 4, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const request = https.get(url, (response) => {
            const status = Number(response.statusCode || 0);
            if ([301, 302, 303, 307, 308].includes(status) && response.headers.location && redirectsLeft > 0) {
                const nextUrl = new URL(response.headers.location, url).toString();
                resolve(fetchText(nextUrl, redirectsLeft - 1, timeoutMs));
                return;
            }
            if (status < 200 || status >= 300) {
                reject(new Error(`Failed fetching URL ${url} (HTTP ${status})`));
                return;
            }
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            response.on("error", reject);
        });
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error(`Timeout fetching ${url}`));
        });
        request.on("error", reject);
    });
}

function parseCpiSeries(csvText) {
    const rows = parse(String(csvText || ""), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
    });

    const byMonth = new Map();
    for (let i = 0; i < rows.length; i += 1) {
        const date = String(rows[i].observation_date || rows[i].DATE || "").trim();
        const cpi = Number.parseFloat(String(rows[i].CPIAUCSL || rows[i].VALUE || "").trim());
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(cpi) || cpi <= 0) continue;
        const month = date.slice(0, 7);
        byMonth.set(month, cpi);
    }
    return byMonth;
}

function buildInflationIndex(cpiByMonth) {
    const months = Array.from(cpiByMonth.keys()).sort();
    if (!months.length) return null;

    const latestMonth = months[months.length - 1];
    const latestCpi = cpiByMonth.get(latestMonth);
    if (!Number.isFinite(latestCpi) || latestCpi <= 0) return null;

    const monthlyDollarIndex = {};
    for (let i = 0; i < months.length; i += 1) {
        const month = months[i];
        const cpi = cpiByMonth.get(month);
        if (!Number.isFinite(cpi) || cpi <= 0) continue;
        monthlyDollarIndex[month] = Number(((latestCpi / cpi) * 100).toFixed(2));
    }

    return {
        source: "FRED CPIAUCSL",
        sourceUrl: FRED_CPI_URL,
        latestMonth,
        baseline: "latestMonth=100",
        monthlyDollarIndex,
    };
}

async function fetchLiveInflationSeries() {
    const csvText = await fetchText(FRED_CPI_URL);
    const cpiByMonth = parseCpiSeries(csvText);
    return buildInflationIndex(cpiByMonth);
}

module.exports = {
    FRED_CPI_URL,
    fetchLiveInflationSeries,
};
