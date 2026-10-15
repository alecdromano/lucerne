const path = require("node:path");
const { readJsonFile } = require("./util.js");
const { countCsvRows } = require("./csv.js");
const { formatSeconds, formatCompactCount } = require("./format.js");

class ProgressTracker {
    constructor({ totalRows = null, enabled = true, updateEvery = 500, width = 30 } = {}) {
        this.totalRows = totalRows;
        this.enabled = enabled;
        this.updateEvery = Math.max(updateEvery, 1);
        this.width = Math.max(width, 10);
        this.startTime = Date.now();
        this.lastShown = 0;
        this.spinner = "|/-\\";
        this.spinnerIndex = 0;
    }

    update(processed, force = false) {
        if (!this.enabled) return;
        if (!force && processed - this.lastShown < this.updateEvery) return;

        this.lastShown = processed;
        const elapsed = Math.max((Date.now() - this.startTime) / 1000, 1e-9);
        const rate = processed / elapsed;

        let message = "";
        if (this.totalRows) {
            const ratio = Math.min(processed / this.totalRows, 1.0);
            const filled = Math.floor(this.width * ratio);
            const bar = "=".repeat(filled) + "-".repeat(this.width - filled);
            const eta = rate > 0 ? (this.totalRows - processed) / rate : 0;
            const percent = (ratio * 100).toFixed(2).padStart(6, " ");
            const counts = `${processed.toLocaleString()}/${this.totalRows.toLocaleString()}`;
            message = `\r[${bar}] ${percent}% (${counts}) ${Math.round(rate).toLocaleString()} rows/s ETA ${formatSeconds(eta)}`;
        } else {
            const spin = this.spinner[this.spinnerIndex % this.spinner.length];
            this.spinnerIndex += 1;
            const rowCount = processed.toLocaleString();
            const rateFormatted = Math.round(rate).toLocaleString();
            message = `\r[${spin}] Processed ${rowCount} rows (${rateFormatted} rows/s, elapsed ${formatSeconds(elapsed)})`;
        }

        process.stdout.write(message);
    }

    finish(processed) {
        if (!this.enabled) return;
        this.update(processed, true);
        process.stdout.write("\n");
    }
}

class StackedProgressTracker {
    constructor({ stages = [], enabled = true, updateEvery = 500, width = 24 } = {}) {
        this.stages = stages.map((stage) => ({ ...stage, completed: 0 }));
        this.enabled = enabled;
        this.updateEvery = Math.max(updateEvery, 1);
        this.width = Math.max(width, 10);
        this.lastShown = 0;
        this.totalProcessed = 0;
        this.rendered = false;
        this.pendingByStage = new Map();
    }

    start() {
        if (!this.enabled) return;
        this.render();
    }

    resolveStageKey(key) {
        if (!key) return "";
        const aliasMap = {
            c: "customers",
            v: "vehicles",
            i: "inventory",
            o: "orders",
            l: "lineitems",
        };
        return aliasMap[key] || key;
    }

    step(stageKey, count = 1) {
        if (!this.enabled) return;
        const resolvedKey = this.resolveStageKey(stageKey);
        const pending = (this.pendingByStage.get(resolvedKey) || 0) + count;
        if (pending >= this.updateEvery) {
            this.pendingByStage.set(resolvedKey, 0);
            this.updateStage(resolvedKey, pending);
        } else {
            this.pendingByStage.set(resolvedKey, pending);
        }
    }
    updateStage(stageKey, increment = 1, force = false) {
        if (!this.enabled) return;
        const resolvedKey = this.resolveStageKey(stageKey);
        const stage = this.stages.find((entry) => entry.key === resolvedKey);
        if (!stage) return;

        const amount = Number.isFinite(increment) ? increment : 0;
        stage.completed += amount;
        this.totalProcessed += amount;

        if (!this.rendered) {
            this.render();
            if (!force && this.totalProcessed - this.lastShown < this.updateEvery) return;
        }

        if (!force && this.totalProcessed - this.lastShown < this.updateEvery) return;
        this.lastShown = this.totalProcessed;
        this.render();
    }

    setStageCompleted(stageKey, completed, force = false) {
        if (!this.enabled) return;
        const resolvedKey = this.resolveStageKey(stageKey);
        const stage = this.stages.find((entry) => entry.key === resolvedKey);
        if (!stage) return;

        this.pendingByStage.set(resolvedKey, 0);
        const next = Math.max(0, Number(completed) || 0);
        const delta = next - stage.completed;
        if (delta === 0 && !force) return;

        stage.completed = next;
        this.totalProcessed += delta;

        if (!this.rendered) {
            this.render();
            if (!force && this.totalProcessed - this.lastShown < this.updateEvery) return;
        }

        if (!force && this.totalProcessed - this.lastShown < this.updateEvery) return;
        this.lastShown = this.totalProcessed;
        this.render();
    }

    setStageTotal(stageKey, total, force = false) {
        if (!this.enabled) return;
        const resolvedKey = this.resolveStageKey(stageKey);
        const stage = this.stages.find((entry) => entry.key === resolvedKey);
        if (!stage) return;

        stage.total = Number.isFinite(total) ? Math.max(0, Number(total)) : null;
        if (force) {
            this.render();
        }
    }

    buildLine(stage) {
        const label = String(stage.label || stage.key || "?").padEnd(9, " ");
        if (Number.isFinite(stage.total) && stage.total >= 0) {
            const columns = Math.max(process.stdout.columns || 80, 40);
            const total = Math.max(stage.total, 0);
            const clamped = Math.min(Math.max(stage.completed, 0), total);
            const ratio = total === 0 ? 1 : (clamped / total);
            const counts = `(${formatCompactCount(clamped)}/${formatCompactCount(total)})`;
            const percent = `${(ratio * 100).toFixed(2).padStart(6, " ")}%`;
            const fixedWidth = label.length + percent.length + counts.length + 4;
            const barWidth = Math.max(Math.min(this.width, columns - fixedWidth), 8);
            const filled = Math.floor(barWidth * ratio);
            const bar = "=".repeat(filled) + "-".repeat(barWidth - filled);
            return `${label} [${bar}] ${percent} ${counts}`;
        }
        const spin = "|/-\\"[Math.abs(this.totalProcessed) % 4];
        return `${label} [${spin}] ${Math.round(stage.completed).toLocaleString()} rows`;
    }

    render() {
        if (!this.enabled) return;
        const lines = this.stages.map((stage) => this.buildLine(stage));

        if (!this.rendered) {
            process.stdout.write(`${lines.join("\n")}\n`);
            this.rendered = true;
            return;
        }

        process.stdout.write(`\x1b[${lines.length}F`);
        for (const line of lines) {
            process.stdout.write(`\x1b[2K${line}\n`);
        }
    }

    finish() {
        if (!this.enabled) return;
        for (const [stageKey, pending] of this.pendingByStage.entries()) {
            if (pending > 0) {
                this.updateStage(stageKey, pending, true);
                this.pendingByStage.set(stageKey, 0);
            }
        }
        this.render();
    }
}

const PROGRESS_STAGE = Object.freeze({
    CUSTOMERS: "customers",
    VEHICLES: "vehicles",
    INVENTORY: "inventory",
    ORDERS: "orders",
    LINEITEMS: "lineitems",
});

function createStackedTracker(options = {}) {
    if (options.showProgress === false) return null;
    const rootDir = path.resolve(__dirname, "../..");
    const progressCfg = readJsonFile(path.join(rootDir, "config", "progress.json"), {});
    const updateEvery = options.progressEvery || progressCfg.updateEvery || 500;
    const width = progressCfg.stackedWidth || 24;

    const stages = [
        { key: PROGRESS_STAGE.CUSTOMERS, label: "Customers", total: null },
        { key: PROGRESS_STAGE.VEHICLES, label: "Vehicles", total: null },
        { key: PROGRESS_STAGE.INVENTORY, label: "Inventory", total: null },
        { key: PROGRESS_STAGE.ORDERS, label: "Orders", total: null },
        { key: PROGRESS_STAGE.LINEITEMS, label: "LineItems", total: null },
    ];

    const tracker = new StackedProgressTracker({
        stages,
        enabled: true,
        updateEvery,
        width,
    });

    const clampRows = (val) => (options.maxRows != null && val != null ? Math.min(val, options.maxRows) : val);
    const clampOrders = (val) => {
        let count = clampRows(val);
        if (options.maxOrders != null && options.maxOrders > 0 && count != null) {
            count = Math.min(count, options.maxOrders);
        }
        return count;
    };

    tracker.setStageTotal(PROGRESS_STAGE.CUSTOMERS, clampRows(countCsvRows(options.inputCustomers)), false);
    tracker.setStageTotal(PROGRESS_STAGE.VEHICLES, clampRows(countCsvRows(options.inputVehicles)), false);
    tracker.setStageTotal(PROGRESS_STAGE.INVENTORY, clampRows(countCsvRows(options.inputInventory)), false);
    tracker.setStageTotal(PROGRESS_STAGE.ORDERS, clampOrders(countCsvRows(options.inputOrders)), false);
    tracker.setStageTotal(PROGRESS_STAGE.LINEITEMS, clampRows(countCsvRows(options.inputOrderItems)), false);
    return tracker;
}

module.exports = {
    PROGRESS_STAGE,
    formatSeconds,
    formatCompactCount,
    ProgressTracker,
    StackedProgressTracker,
    createStackedTracker,
};
