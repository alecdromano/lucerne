function base64ToBlob(base64, mimeType) {
    const binStr = window.atob(base64);
    const bytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
    return new Blob([bytes], { type: mimeType || "application/zip" });
}

function downloadMigrationPackage(targetKey) {
    const packages = (payload && payload.migrationPackages) || {};
    const pkg = packages[targetKey];
    if (!pkg || !pkg.base64) {
        alert("Migration package not found for " + targetKey);
        return;
    }
    const blob = base64ToBlob(pkg.base64, "application/zip");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pkg.filename || (targetKey + "-migration.zip");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
}

function initNextstep() {
    if (!nextstep) return;

    if (payload && payload.nomigrate) {
        if (nextstep.parentNode) {
            nextstep.parentNode.removeChild(nextstep);
        }
        return;
    }

    // Populate platform options from embedded packages
    const packages = (payload && payload.migrationPackages) || {};
    const packageKeys = Object.keys(packages);
    if (nextstepPlatform) {
        if (packageKeys.length) {
            nextstepPlatform.innerHTML = "";
            packageKeys.forEach(function(key) {
                const pkg = packages[key];
                const opt = document.createElement("option");
                opt.value = key;
                opt.textContent = (pkg && pkg.name) ? pkg.name : key;
                nextstepPlatform.appendChild(opt);
            });
        } else {
            nextstepPlatform.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "None available";
            nextstepPlatform.appendChild(opt);
            if (nextstepMigrateBtn) {
                nextstepMigrateBtn.disabled = true;
            }
        }
    }

    // Render technical data stats
    if (nextstepStats) {
        const existingGeneratedBadge = nextstepStats.querySelector(".nextstep-stat-badge");
        nextstepStats.innerHTML = "";
        const stats = (payload && payload.dataStats) || {};
        const ordersList = (payload && payload.orders) || [];
        const packages = (payload && payload.migrationPackages) || {};
        const firstPkg = Object.values(packages)[0] || {};
        const pkgResults = firstPkg.results || {};

        // Calculate deep technical data properties across the full raw archive payload
        let totalLineItems = 0;
        let totalParts = 0;
        let totalLabor = 0;
        let totalPaymentTxs = 0;
        let uniqueCustSet = new Set();
        let uniqueVehSet = new Set();
        let minDateStr = null;
        let maxDateStr = null;

        for (let i = 0; i < ordersList.length; i++) {
            const o = ordersList[i];
            if (o.customerName) uniqueCustSet.add(o.customerName);
            if (o.vehicleDetail && Array.isArray(o.vehicleDetail)) {
                for (let v = 0; v < o.vehicleDetail.length; v++) {
                    if (o.vehicleDetail[v][0] === "VIN" && o.vehicleDetail[v][1]) {
                        uniqueVehSet.add(o.vehicleDetail[v][1]);
                        break;
                    }
                }
            }
            if (o.invoiceDateIso) {
                if (!minDateStr || o.invoiceDateIso < minDateStr) minDateStr = o.invoiceDateIso;
                if (!maxDateStr || o.invoiceDateIso > maxDateStr) maxDateStr = o.invoiceDateIso;
            }
            if (o.lineItems && Array.isArray(o.lineItems)) {
                totalLineItems += o.lineItems.length;
                for (let j = 0; j < o.lineItems.length; j++) {
                    if (o.lineItems[j].type === "Labor") totalLabor++;
                    else totalParts++;
                }
            }
            if (o.paymentTransactions && Array.isArray(o.paymentTransactions)) {
                totalPaymentTxs += o.paymentTransactions.length;
            }
        }

        function createStatBadge(label, val, title) {
            if (val == null || val === "" || val === "0") return null;
            const badge = document.createElement("div");
            badge.className = "nextstep-stat-badge";
            if (title) badge.title = title;
            const lSpan = document.createElement("span");
            lSpan.className = "nextstep-stat-label";
            lSpan.textContent = label;
            const vSpan = document.createElement("span");
            vSpan.className = "nextstep-stat-val";
            vSpan.textContent = typeof val === "number" ? val.toLocaleString() : String(val);
            badge.appendChild(lSpan);
            badge.appendChild(vSpan);
            return badge;
        }

        function renderNextstepStats() {
            nextstepStats.innerHTML = "";
            const selectedTarget = (nextstepPlatform && nextstepPlatform.value) || packageKeys[0] || "";
            const currentPkg = packages[selectedTarget] || firstPkg;
            const pkgResults = currentPkg.results || {};

            const addBadge = function(label, val, title) {
                const b = createStatBadge(label, val, title);
                if (b) nextstepStats.appendChild(b);
            };

            const sourceFiles = stats.sourceFiles || [];
            for (let s = 0; s < sourceFiles.length; s++) {
                const src = sourceFiles[s];
                const rowCount = typeof src.rows === "number" ? src.rows : 0;
                addBadge(src.name, rowCount, (src.description || src.name) + ": " + rowCount.toLocaleString() + " rows");
            }

            // 2. Invoices
            const rawOrdersCount = stats.rawOrderRows != null ? stats.rawOrderRows : ordersList.length;
            addBadge("Invoices", rawOrdersCount, "Total number of source invoice records");

            // 3. Customers
            const custCount = pkgResults.customers != null ? pkgResults.customers : (uniqueCustSet.size || null);
            addBadge("Customers", custCount, "Total unique customer accounts for " + (currentPkg.name || selectedTarget));

            // 4. Vehicles
            const vehCount = pkgResults.vehicles != null ? pkgResults.vehicles : (uniqueVehSet.size || null);
            addBadge("Vehicles", vehCount, "Total unique vehicle records for " + (currentPkg.name || selectedTarget));

            // 5. Inventory
            if (pkgResults.inventory != null && pkgResults.inventory > 0) {
                addBadge("Inventory", pkgResults.inventory, "Total catalog and stock inventory records for " + (currentPkg.name || selectedTarget));
            }

            // 6. Transactions (payments, deposits, and refunds)
            if (totalPaymentTxs > 0) {
                addBadge("Transactions", totalPaymentTxs, "Total payment, deposit, and ledger transactions");
            }

            // 7. Date Range
            if (minDateStr && maxDateStr) {
                const minYear = minDateStr.slice(0, 4);
                const maxYear = maxDateStr.slice(0, 4);
                const spanStr = minYear === maxYear ? minYear : (minYear + "–" + maxYear);
                addBadge("Date Range", spanStr, "Historical date span of source data: " + minDateStr + " to " + maxDateStr);
            }

            // 8. Package Size
            if (currentPkg.sizeBytes) {
                const zipKb = (currentPkg.sizeBytes / 1024).toFixed(1) + " KB";
                addBadge("Package Size", zipKb, "Compressed file size of the embedded " + (currentPkg.name || selectedTarget) + " migration ZIP package");
            }

            // 9. Generated Date badge
            if (existingGeneratedBadge) {
                nextstepStats.appendChild(existingGeneratedBadge);
            } else if (payload && payload.generatedAt) {
                const formattedGenDate = formatDisplayDateClient(payload.generatedAt);
                if (formattedGenDate) {
                    const genDate = new Date(payload.generatedAt);
                    const titleText = !isNaN(genDate.getTime()) ? ("File generation timestamp: " + genDate.toLocaleString()) : "";
                    addBadge("Generated", formattedGenDate, titleText);
                }
            }

            updateEdgeFade();
        }

        function updateEdgeFade() {
            if (!nextstepStats) return;
            const scrollLeft = nextstepStats.scrollLeft;
            const maxScroll = Math.max(0, nextstepStats.scrollWidth - nextstepStats.clientWidth);
            const threshold = 4;
            const hasLeft = scrollLeft > threshold;
            const hasRight = (maxScroll - scrollLeft) > threshold;
            nextstepStats.classList.toggle("has-scroll-left", hasLeft);
            nextstepStats.classList.toggle("has-scroll-right", hasRight);
        }

        let isDown = false;
        let startX = 0;
        let scrollStart = 0;

        nextstepStats.addEventListener("mousedown", function(e) {
            if (e.button !== 0) return;
            isDown = true;
            nextstepStats.classList.add("is-dragging");
            startX = e.pageX - nextstepStats.offsetLeft;
            scrollStart = nextstepStats.scrollLeft;
        });

        window.addEventListener("mouseup", function() {
            if (!isDown) return;
            isDown = false;
            if (nextstepStats) nextstepStats.classList.remove("is-dragging");
        });

        window.addEventListener("mousemove", function(e) {
            if (!isDown || !nextstepStats) return;
            e.preventDefault();
            const x = e.pageX - nextstepStats.offsetLeft;
            const walk = x - startX;
            nextstepStats.scrollLeft = scrollStart - walk;
            updateEdgeFade();
        });

        nextstepStats.addEventListener("scroll", updateEdgeFade, { passive: true });
        window.addEventListener("resize", updateEdgeFade, { passive: true });

        renderNextstepStats();

        if (nextstepPlatform) {
            nextstepPlatform.addEventListener("change", renderNextstepStats);
        }
    }

    if (nextstepMigrateBtn) {
        nextstepMigrateBtn.addEventListener("click", function() {
            const target = (nextstepPlatform && nextstepPlatform.value) || packageKeys[0] || "";
            if (target) downloadMigrationPackage(target);
        });
    }
}

initNextstep();

