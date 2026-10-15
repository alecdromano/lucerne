function openTrendModal(definition) {
    activeTrendId = String(definition.id || "");
    trendModalTitle.textContent = definition.title;
    trendModalSubtitle.textContent = definition.subtitle;
    trendModal.classList.add("is-open");
    trendModal.setAttribute("aria-hidden", "false");
    activeTrendRenderer = function() {
        if (!trendModal.classList.contains("is-open") || !activeTrendId) return;
        const cssWidth = Math.max(320, Math.round(trendModalCanvas.clientWidth || trendModalCanvas.getBoundingClientRect().width || 940));
        if (trendModalCanvas.width !== cssWidth) trendModalCanvas.width = cssWidth;
        const liveDefinition = getTrendDefinitions().find(function(def) {
            return String(def.id || "") === activeTrendId;
        }) || definition;
        trendModalTitle.textContent = liveDefinition.title;
        trendModalSubtitle.textContent = liveDefinition.subtitle;
        liveDefinition.render(trendModalCanvas, false);
    };
    activeTrendRenderer();
}

function closeTrendModal() {
    const chart = trendChartInstances.get(trendModalCanvas);
    if (chart) {
        chart.destroy();
        trendChartInstances.delete(trendModalCanvas);
    }
    trendModal.classList.remove("is-open");
    trendModal.setAttribute("aria-hidden", "true");
    modalSmoothLineEnabled = false;
    renderTrendOptionState();
    activeTrendId = "";
    activeTrendRenderer = null;
}

function renderTrendCards() {
    const trends = getTrendDefinitions();
    const existingThumbs = trendList.querySelectorAll("canvas");
    for (let i = 0; i < existingThumbs.length; i += 1) {
        const chart = trendChartInstances.get(existingThumbs[i]);
        if (chart) {
            chart.destroy();
            trendChartInstances.delete(existingThumbs[i]);
        }
    }
    trendList.replaceChildren();

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < trends.length; i += 1) {
        const def = trends[i];
        const card = createEl("button", "trend-card");
        card.type = "button";
        card.appendChild(createEl("div", "trend-card-title", def.title));

        const thumb = createEl("canvas", "trend-thumb");
        thumb.height = 74;
        card.appendChild(thumb);

        card.addEventListener("click", function() {
            openTrendModal(def);
        });

        fragment.appendChild(card);
    }
    trendList.appendChild(fragment);

    const thumbs = trendList.querySelectorAll("canvas.trend-thumb");
    for (let i = 0; i < trends.length; i += 1) {
        const thumb = thumbs[i];
        if (!thumb) continue;
        const cssWidth = Math.max(80, Math.round(thumb.clientWidth || thumb.getBoundingClientRect().width || 196));
        if (thumb.width !== cssWidth) thumb.width = cssWidth;
        trends[i].render(thumb, true);
    }
}

function hasNonDateFiltersActive() {
    return !!(
        (search.value || "").trim()
        || !includePosted
        || !includeUnposted
        || !includeVoided
        || !includeBlankStatus
        || requireMarked
        || requirePayments
        || requireDeposit
        || requireBalanceDue
        || requireFullyPaid
        || requireMostlyPaid
        || requireLabor
        || requireLaborDuration
        || selectedSalespeople.size
        || selectedCustomTags.size
    );
}

