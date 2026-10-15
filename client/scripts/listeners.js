if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function(entries) {
        for (let i = 0; i < entries.length; i += 1) {
            if (entries[i].isIntersecting) {
                renderNextPage(false, false);
                break;
            }
        }
    }, {
        root: ordersPane,
        rootMargin: "300px 0px",
        threshold: 0,
    });
    observer.observe(loadMore);
} else {
    ordersPane.addEventListener("scroll", maybeLoadMore, { passive: true });
}

search.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        applyFilter();
    }
});
searchBtn.addEventListener("click", applyFilter);
filterDateFrom.addEventListener("change", applyFilter);
filterDateTo.addEventListener("change", applyFilter);
printBtn.addEventListener("click", function() {
    window.print();
});
sortBy.addEventListener("change", applyFilter);
sortDir.addEventListener("change", applyFilter);
tagPosted.addEventListener("change", function() {
    includePosted = !!tagPosted.checked;
    renderTagState();
    applyFilter();
});
tagUnposted.addEventListener("change", function() {
    includeUnposted = !!tagUnposted.checked;
    renderTagState();
    applyFilter();
});
tagVoided.addEventListener("change", function() {
    includeVoided = !!tagVoided.checked;
    renderTagState();
    applyFilter();
});
tagBlankStatus.addEventListener("change", function() {
    includeBlankStatus = !!tagBlankStatus.checked;
    renderTagState();
    applyFilter();
});
tagMarked.addEventListener("click", function() {
    requireMarked = !requireMarked;
    renderTagState();
    applyFilter();
});
tagPayments.addEventListener("click", function() {
    requirePayments = !requirePayments;
    renderTagState();
    applyFilter();
});
tagDeposits.addEventListener("click", function() {
    requireDeposit = !requireDeposit;
    renderTagState();
    applyFilter();
});
tagBalanceDue.addEventListener("click", function() {
    requireBalanceDue = !requireBalanceDue;
    renderTagState();
    applyFilter();
});
tagFullyPaid.addEventListener("click", function() {
    requireFullyPaid = !requireFullyPaid;
    renderTagState();
    applyFilter();
});
tagMostlyPaid.addEventListener("click", function() {
    requireMostlyPaid = !requireMostlyPaid;
    renderTagState();
    applyFilter();
});
tagHasLabor.addEventListener("click", function() {
    requireLabor = !requireLabor;
    renderTagState();
    applyFilter();
});
tagHasLaborDuration.addEventListener("click", function() {
    requireLaborDuration = !requireLaborDuration;
    renderTagState();
    applyFilter();
});
clearBtn.addEventListener("click", function() {
    search.value = "";
    filterDateFrom.value = "";
    filterDateTo.value = "";
    sortBy.value = "invoiceDate";
    sortDir.value = "desc";
    includePosted = true;
    includeUnposted = true;
    includeVoided = true;
    includeBlankStatus = true;
    requireMarked = false;
    requirePayments = false;
    requireDeposit = false;
    requireBalanceDue = false;
    requireFullyPaid = false;
    requireMostlyPaid = false;
    requireLabor = false;
    requireLaborDuration = false;
    excludeEdgeMonths = true;
    clampOutliersEnabled = true;
    trendClampIqrMultiplier = TREND_CLAMP_DEFAULT;
    trendClampLastNonZero = TREND_CLAMP_DEFAULT;
    selectedSalespeople.clear();
    selectedCustomTags.clear();
    deltaPairMap.forEach(function(pair) {
        const el = deltaPairTextEls[pair.textId];
        if (el) el.value = "0";
    });
    renderSalespersonFilters();
    renderCustomTagFilters();
    renderTagState();
    renderTrendOptionState();
    applyFilter();
    search.focus();
});

trendClampRange.addEventListener("input", function() {
    updateTrendClampState(trendClampRange.value);
});
modalTrendClampRange.addEventListener("input", function() {
    updateTrendClampState(modalTrendClampRange.value);
});
modalSmoothLineToggle.addEventListener("change", function() {
    modalSmoothLineEnabled = !!modalSmoothLineToggle.checked;
    renderTrendOptionState();
    if (trendModal.classList.contains("is-open") && activeTrendRenderer) {
        window.requestAnimationFrame(function() {
            if (activeTrendRenderer) activeTrendRenderer();
        });
    }
});
trendClampReset.addEventListener("click", function() {
    resetTrendClampToDefault();
});
modalTrendClampReset.addEventListener("click", function() {
    resetTrendClampToDefault();
});

clampOutliersToggle.addEventListener("change", function() {
    setClampOutliersEnabled(clampOutliersToggle.checked);
});
modalClampOutliersToggle.addEventListener("change", function() {
    setClampOutliersEnabled(modalClampOutliersToggle.checked);
});

excludeEdgeMonthsToggle.addEventListener("change", function() {
    setExcludeEdgeMonthsEnabled(excludeEdgeMonthsToggle.checked);
});
modalExcludeEdgeMonthsToggle.addEventListener("change", function() {
    setExcludeEdgeMonthsEnabled(modalExcludeEdgeMonthsToggle.checked);
});
const sidebarToggleBtn = document.getElementById("sidebarToggleBtn");
const sidebarCloseBtn = document.getElementById("sidebarCloseBtn");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const filterSidebar = document.querySelector(".filter-sidebar");
const appShell = document.querySelector(".app-shell");

function toggleSidebar() {
    if (!filterSidebar || window.innerWidth > 900) return;
    const isOpen = filterSidebar.classList.contains("is-open");
    if (isOpen) {
        filterSidebar.classList.remove("is-open");
        if (sidebarBackdrop) sidebarBackdrop.classList.remove("is-open");
        if (sidebarToggleBtn) sidebarToggleBtn.setAttribute("aria-expanded", "false");
    } else {
        filterSidebar.classList.add("is-open");
        if (sidebarBackdrop) sidebarBackdrop.classList.add("is-open");
        if (sidebarToggleBtn) sidebarToggleBtn.setAttribute("aria-expanded", "true");
        window.requestAnimationFrame(function() {
            renderOverviewCharts();
            renderTrendCards();
        });
    }
}

function closeSidebar() {
    if (filterSidebar) filterSidebar.classList.remove("is-open");
    if (sidebarBackdrop) sidebarBackdrop.classList.remove("is-open");
    if (sidebarToggleBtn) sidebarToggleBtn.setAttribute("aria-expanded", "false");
}

if (sidebarToggleBtn) sidebarToggleBtn.addEventListener("click", toggleSidebar);
if (sidebarCloseBtn) sidebarCloseBtn.addEventListener("click", closeSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeSidebar);

loadUiState();
loadMarkedInvoices();
loadOrderTags();
totalStatusCounts = countStatusesByIndices(orders.map(function(_, idx) { return idx; }));
renderSalespersonFilters();
renderCustomTagFilters();
renderTagState();
renderTrendOptionState();
bindOverviewTooltipRouting();
applyFilter();
window.requestAnimationFrame(function() {
    window.requestAnimationFrame(hideLoadingOverlay);
});

