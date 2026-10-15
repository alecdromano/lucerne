
function renderOverviewStatusChart() {
    const current = countStatusesByIndices(matchedIndices);
    const allLabels = ["Posted", "Unposted", "Voided", "Other"];
    const allCurrentValues = [current.posted, current.unposted, current.voided, current.other];
    const allPalette = [statusPostedColor, statusUnpostedColor, statusVoidedColor, statusOtherColor];
    const activeFlags = [includePosted, includeUnposted, includeVoided, includeBlankStatus];
    const visible = activeFlags.map(function(flag, i) { return flag && allCurrentValues[i] > 0; });

    const labels = allLabels;
    const currentValues = allCurrentValues;
    const palette = allPalette;
    // Compress large-vs-small spread so the chart remains readable under skewed distributions.
    const WEIGHT_EXPONENT = overviewWeightExponent;
    const weight = function(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric <= 0) return 0;
        return Math.pow(numeric, WEIGHT_EXPONENT);
    };
    const inverseWeight = function(value) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric) || numeric <= 0) return 0;
        return Math.pow(numeric, 1 / WEIGHT_EXPONENT);
    };
    const weightedCurrentValues = currentValues.map(weight);
    const scaleMax = Math.max(1, Math.max.apply(null, weightedCurrentValues.length ? weightedCurrentValues : [1]));
    const polarInsetFactor = overviewPolarInsetFactor;
    const chartScaleMax = scaleMax * polarInsetFactor;

    if (overviewChartInstance) {
        overviewChartInstance.data.labels = labels;
        overviewChartInstance.data.datasets[0].data = weightedCurrentValues;
        overviewChartInstance.data.datasets[0].backgroundColor = palette.map(function(c) { return withAlpha(c, overviewPolarFillAlpha); });
        overviewChartInstance.data.datasets[0].borderColor = palette;
        overviewChartInstance.data.datasets[0].borderWidth = overviewPolarStrokeWidth;
        overviewChartInstance.options.animation.duration = overviewPolarAnimationDuration;
        overviewChartInstance.options.animation.easing = overviewPolarAnimationEasing;
        overviewChartInstance.options.scales.r.max = chartScaleMax;
        overviewChartInstance.options.scales.r.startAngle = overviewPolarStartAngle;
        overviewChartInstance.options.scales.r.ticks.stepSize = chartScaleMax / overviewPolarRingCount;
        overviewChartInstance.options.scales.r.ticks.color = overviewPolarTickColorConfig;
        overviewChartInstance.options.scales.r.ticks.font = {
            size: overviewPolarTickFontSize,
            weight: overviewPolarTickFontWeight,
        };
        overviewChartInstance.options.scales.r.grid.color = overviewPolarGridColor;
        overviewChartInstance.options.scales.r.angleLines.color = overviewPolarAngleLineColor;
        overviewChartInstance.options.scales.r.ticks.callback = function(weightedValue) {
            return formatCompactCount(inverseWeight(weightedValue));
        };
        overviewChartInstance.update();
    } else {
        overviewChartInstance = new window.Chart(overviewStatusChart, {
            type: "polarArea",
            data: {
                labels: labels,
                datasets: [
                    {
                        data: weightedCurrentValues,
                        backgroundColor: palette.map(function(c) { return withAlpha(c, overviewPolarFillAlpha); }),
                        borderColor: palette,
                        borderWidth: overviewPolarStrokeWidth,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                animation: {
                    duration: overviewPolarAnimationDuration,
                    easing: overviewPolarAnimationEasing,
                },
                layout: {
                    padding: 0,
                },
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            label: function(ctx) {
                                const rawValue = Number(currentValues[ctx.dataIndex] || 0);
                                return ctx.label + ": " + rawValue.toLocaleString();
                            },
                        },
                    },
                },
                scales: {
                    r: {
                        display: true,
                        max: chartScaleMax,
                        min: 0,
                        startAngle: overviewPolarStartAngle,
                        ticks: {
                            display: true,
                            showLabelBackdrop: false,
                            color: overviewPolarTickColorConfig,
                            font: {
                                size: overviewPolarTickFontSize,
                                weight: overviewPolarTickFontWeight,
                            },
                            stepSize: chartScaleMax / overviewPolarRingCount,
                            callback: function(weightedValue) {
                                return formatCompactCount(inverseWeight(weightedValue));
                            },
                        },
                        grid: {
                            display: true,
                            color: overviewPolarGridColor,
                        },
                        angleLines: {
                            display: true,
                            color: overviewPolarAngleLineColor,
                        },
                        pointLabels: { display: false },
                    },
                },
            },
        });
    }

    overviewLegend.replaceChildren();
    const visibleTotal = currentValues.reduce(function(sum, value) {
        return sum + Number(value || 0);
    }, 0);
    for (let i = 0; i < labels.length; i += 1) {
        const value = Number(currentValues[i] || 0);
        const pct = visibleTotal > 0 ? ((value / visibleTotal) * 100) : 0;
        const item = createEl("div", "overview-legend-item");
        const swatch = createEl("span", "overview-legend-swatch");
        swatch.style.background = palette[i];
        item.appendChild(swatch);
        item.appendChild(createEl("span", "", labels[i] + " " + value.toLocaleString() + " (" + pct.toFixed(2) + "%)"));
        overviewLegend.appendChild(item);
    }

    const profitability = computeFilteredAggregateProfitability();
    const aggregateProfitValue = Number(profitability.aggregateProfit || 0);
    const hasLoss = aggregateProfitValue < 0;
    const gainOrLossValue = hasLoss ? Math.abs(aggregateProfitValue) : Math.max(0, aggregateProfitValue);
    const gainOrLossLabel = hasLoss ? "Loss" : "Profit";
    const gainOrLossColor = hasLoss ? overviewLossColor : overviewProfitColor;
    const partsCostValue = Math.max(0, Number(profitability.aggregatePartsCost || 0));
    const laborCostValue = Math.max(0, Number(profitability.aggregateLaborCost || 0));
    const profitTotal = gainOrLossValue + partsCostValue + laborCostValue;

    if (profitTotal > 0) {
        const entries = [
            { label: gainOrLossLabel, value: gainOrLossValue, color: gainOrLossColor },
            { label: "Parts Cost", value: partsCostValue, color: overviewPartsCostColor },
            { label: "Labor Cost", value: laborCostValue, color: overviewLaborCostColor },
        ];

        for (let i = 0; i < entries.length; i += 1) {
            const entry = entries[i];
            const pct = (entry.value / profitTotal) * 100;
            const signedValue = entry.label === "Loss" ? -Math.abs(entry.value) : entry.value;
            const legendItem = createEl("div", "overview-legend-item");
            const swatch = createEl("span", "overview-legend-swatch");
            swatch.style.background = entry.color;
            legendItem.appendChild(swatch);
            legendItem.appendChild(createEl(
                "span",
                "",
                entry.label + " " + (signedValue < 0 ? "-$" : "$") + Math.abs(signedValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " (" + pct.toFixed(2) + "%)"
            ));
            overviewLegend.appendChild(legendItem);
        }
    }

    if (overviewSummary) {
        const currentCount = matchedIndices.length;
        const totalCount = orders.length;
        const filteredInvoiceValue = matchedIndices.reduce(function(sum, idx) {
            const order = orders[idx] || {};
            const netRevenueAmount = Number(order.netRevenueAmount || order.grossProfitRevenueAmount);
            return sum + (Number.isFinite(netRevenueAmount) ? netRevenueAmount : 0);
        }, 0);
        const moneyLabel = "$" + filteredInvoiceValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        overviewSummary.innerHTML =
            '<div>' + currentCount.toLocaleString() + ' / ' + totalCount.toLocaleString() + '</div>' +
            '<div class="overview-summary-value">' + moneyLabel + '</div>';
    }
}

