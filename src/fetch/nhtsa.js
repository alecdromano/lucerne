const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { Readable } = require("node:stream");
const { finished } = require("node:stream/promises");
const JSZip = require("jszip");

const { formatBytes } = require("../common/util.js");

const execFileAsync = promisify(execFile);
const NHTSA_DOWNLOADS_URL = "https://vpic.nhtsa.dot.gov/Downloads";
const NHTSA_BASE_URL = "https://vpic.nhtsa.dot.gov";

async function fetchLatestNhtsaReleaseInfo() {
    const res = await fetch(NHTSA_DOWNLOADS_URL, {
        headers: {
            "User-Agent": "Lucerne-NHTSA-Sync/1.0",
            Accept: "text/html,application/xhtml+xml",
        },
    });

    if (!res.ok) {
        throw new Error(`Failed to query NHTSA downloads page (${res.status} ${res.statusText})`);
    }

    const html = await res.text();
    const match = html.match(/href="([^"]*vPICList_lite_(\d{4})_(\d{2})\.plain\.zip)"/i);
    if (!match) {
        throw new Error("Could not find a vPICList_lite_YYYY_MM.plain.zip download link on NHTSA Downloads page");
    }

    const relativeOrAbsoluteUrl = match[1];
    const year = Number.parseInt(match[2], 10);
    const month = Number.parseInt(match[3], 10);
    const zipUrl = new URL(relativeOrAbsoluteUrl, NHTSA_BASE_URL).href;
    const zipFilename = `vPICList_lite_${match[2]}_${match[3]}.plain.zip`;
    const sqlFilename = `vPICList_lite_${match[2]}_${match[3]}.sql`;

    return {
        zipUrl,
        zipFilename,
        sqlFilename,
        year,
        month,
    };
}

async function downloadFileWithProgress(url, destPath) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Lucerne-NHTSA-Sync/1.0",
        },
    });

    if (!res.ok) {
        throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    }

    const contentLength = res.headers.get("content-length")
        ? Number.parseInt(res.headers.get("content-length"), 10)
        : null;

    let downloadedBytes = 0;
    let lastReportTime = 0;

    const fileStream = fs.createWriteStream(destPath);
    const nodeReadable = Readable.fromWeb(res.body);

    nodeReadable.on("data", (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now();
        if (now - lastReportTime > 250) {
            lastReportTime = now;
            let msg = `Downloading NHTSA update: ${formatBytes(downloadedBytes)}`;
            if (contentLength) {
                const percent = Math.min(100, Math.round((downloadedBytes / contentLength) * 100));
                msg += ` / ${formatBytes(contentLength)} (${percent}%)`;
            }
            process.stderr.write(`\r${msg}   `);
        }
    });

    await finished(nodeReadable.pipe(fileStream));
    process.stderr.write(`\rDownloaded NHTSA update: ${formatBytes(downloadedBytes)} (100%)\n`);
}

async function extractNhtsaZip(zipPath, targetDir, expectedSqlFilename) {
    const destSqlPath = path.join(targetDir, expectedSqlFilename);

    process.stderr.write(`Extracting ${expectedSqlFilename}...\n`);

    let nativeSuccess = false;
    try {
        await execFileAsync("unzip", ["-o", "-q", zipPath, "-d", targetDir]);
        if (fs.existsSync(destSqlPath) && fs.statSync(destSqlPath).size > 1024 * 1024) {
            nativeSuccess = true;
        }
    } catch {
        nativeSuccess = false;
    }

    if (!nativeSuccess) {
        const zipData = await fs.promises.readFile(zipPath);
        const zip = await JSZip.loadAsync(zipData);

        let zipEntry = zip.file(expectedSqlFilename);
        if (!zipEntry) {
            const matchKey = Object.keys(zip.files).find((k) => k.toLowerCase().endsWith(".sql"));
            if (matchKey) zipEntry = zip.file(matchKey);
        }

        if (!zipEntry) {
            throw new Error(`Archive ${zipPath} does not contain an SQL dump file`);
        }

        const outStream = fs.createWriteStream(destSqlPath);
        await new Promise((resolve, reject) => {
            zipEntry.nodeStream().pipe(outStream).on("finish", resolve).on("error", reject);
        });
    }

    if (!fs.existsSync(destSqlPath)) {
        throw new Error(`Extracted SQL file not found at ${destSqlPath}`);
    }

    const stat = fs.statSync(destSqlPath);
    process.stderr.write(`Ready: ${expectedSqlFilename} (${formatBytes(stat.size)})\n`);

    return destSqlPath;
}

module.exports = {
    fetchLatestNhtsaReleaseInfo,
    downloadFileWithProgress,
    extractNhtsaZip,
};
