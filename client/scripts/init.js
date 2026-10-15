window.addEventListener("beforeprint", preparePrintView);
window.addEventListener("afterprint", restoreAfterPrint);

trendModalClose.addEventListener("click", closeTrendModal);
trendModal.addEventListener("click", function(event) {
    if (event.target === trendModal) {
        closeTrendModal();
    }
});
window.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        if (trendModal.classList.contains("is-open")) {
            closeTrendModal();
        } else if (typeof closeSidebar === "function") {
            closeSidebar();
        }
    }
});
window.addEventListener("resize", function() {
    if (window.innerWidth > 900 && typeof closeSidebar === "function") {
        closeSidebar();
    }
    renderTrendCards();
    if (activeTrendRenderer) activeTrendRenderer();
    renderOverviewCharts();
});
