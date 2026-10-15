#!/usr/bin/env node

const { parseCli } = require("./common/config.js");
const { formatDuration } = require("./common/util.js");
const { TARGETS, getTarget } = require("./migrate/targets.js");
const { runArchive } = require("./archive/run.js");

async function main() {
    const startedAt = Date.now();
    const options = parseCli();

    const log = (msg) => {
        process.stdout.write(`[lucerne] ${msg}\n`);
    };

    log("Starting consolidated Lucerne migration and archival pipeline...");

    // Determine target platforms
    const targetKeys = options.targets && options.targets.length > 0
        ? options.targets
        : Object.keys(TARGETS);

    // Kick off live CPI inflation fetch concurrently in the background
    const { fetchLiveInflationSeries } = require("./fetch/cpi.js");
    const inflationPromise = fetchLiveInflationSeries().catch((err) => {
        process.stderr.write(`Notice: Failed to fetch live FRED CPI data (${err.message}). Continuing without inflation adjustment.\n`);
        return null;
    });

    const migrationPackages = {};

    if (!options.nomigrate) {
        const configuredTargets = [];
        for (const key of targetKeys) {
            const target = getTarget(key);
            if (!target) {
                process.stderr.write(`Warning: unknown migration target "${key}", skipping.\n`);
                continue;
            }

            if (!target.isConfigured()) {
                log(`Skipping target "${target.name}" (schema is unconfigured or empty).`);
                continue;
            }

            configuredTargets.push(target);
        }

        if (configuredTargets.length > 0) {
            // Preload NHTSA index once across all targets
            let sharedNhtsaIndex = null;
            const { ensureNhtsa, parseNhtsaDump } = require("./migrate/vehicles.js");
            try {
                const nhtsaSqlPath = await ensureNhtsa();
                sharedNhtsaIndex = parseNhtsaDump(nhtsaSqlPath);
            } catch (err) {
                process.stderr.write(`Notice: Failed to fetch live NHTSA database (${err.message}). Continuing without vehicle harmonization.\n`);
            }

            for (const target of configuredTargets) {
                log(`Running migration conversion for target: ${target.name}...`);
                const result = await target.run(options, sharedNhtsaIndex);

                migrationPackages[target.id] = {
                    id: target.id,
                    name: result.name,
                    description: result.description,
                    filename: result.filename,
                    results: result.results,
                    sizeBytes: result.zipBuffer.length,
                    base64: result.zipBuffer.toString("base64"),
                };

                const sizeKb = (result.zipBuffer.length / 1024).toFixed(1);
                log(`Target ${target.name} package ready (${sizeKb} KB embedded).`);
            }
        }
    }

    log("Building consolidated HTML archive with embedded migration packages...");
    const archiveResult = await runArchive(options, migrationPackages, inflationPromise);

    const elapsed = formatDuration(Date.now() - startedAt);
    log(`Archive built with ${archiveResult.orderCount} orders in ${elapsed}.`);
    log(`Saved to: ${archiveResult.outputPath}`);
    if (!options.nomigrate) {
        const packageKeys = Object.keys(migrationPackages);
        if (packageKeys.length > 0) {
            log(`Embedded packages: ${packageKeys.join(", ")}`);
        } else {
            log("No migration packages embedded.");
        }
    }
}

if (require.main === module) {
    main().catch((err) => {
        process.stderr.write(`Error: ${err.message}\n`);
        process.exit(1);
    });
}

module.exports = {
    main,
};
