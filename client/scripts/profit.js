                    {
                        id: "grossProfitDollarByDay",
                        title: gpDollarChartTitle,
                        subtitle: hasRequiredGrossProfitDollarSeries
                            ? ("Gross profit dollars for each " + (useMonthly ? "month" : "day") + ", calculated as line-item revenue minus line-item cost. The dashed line is an inflation-adjusted baseline anchored to the first 10% of the full archive timespan." + (trendNotice ? " | " + trendNotice : ""))
                            : ("Gross profit dollars for each " + (useMonthly ? "month" : "day") + ", calculated as line-item revenue minus line-item cost for the current filtered set." + (trendNotice ? " | " + trendNotice : "")),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": $" + latestGrossProfitDollar.toLocaleString()
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": $" + avgGrossProfitDollar.toLocaleString()
                                + (grossProfitDollarBaseline.startLabel && grossProfitDollarBaseline.endLabel && Number.isFinite(grossProfitDollarBaseline.aov)
                                    ? (" | Baseline window " + grossProfitDollarBaseline.startLabel + " to " + grossProfitDollarBaseline.endLabel + ": $" + Number(grossProfitDollarBaseline.aov).toLocaleString())
                                    : "")
                                + (Number.isFinite(latestRequiredGrossProfitDollar) ? (" | GP$ Baseline: $" + Number(latestRequiredGrossProfitDollar).toLocaleString()) : "")
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedGrossProfitDollarValues, getTrendSampleLimit(isThumb));
                            const requiredSeriesValues = series.labels.map(function(label) {
                                const idx = dayLabels.indexOf(label);
                                return idx >= 0 ? inflationValuesByDay[idx] : null;
                            });
                            const plottedBaseline = getFirstWindowBaseline(series.labels, series.values, requiredSeriesValues, 0.1, globalAnchorRange);
                            const requiredSeries = buildRequiredAovSeries(series.values, requiredSeriesValues, plottedBaseline);
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendGpDollarLineColor,
                                primaryLabel: gpDollarChartTitle,
                                maxXLabels: isThumb ? 4 : 10,
                                maxSamples: getTrendSampleLimit(isThumb),
                                curved: isThumb ? true : modalSmoothLineEnabled,
                                tension: trendCurveTension,
                                showAxes: !isThumb,
                                showLabels: !isThumb,
                                showMaxLabel: !isThumb,
                                showPoints: false,
                                secondarySeries: (!activeDateRange.hasDateRange && requiredSeries.hasSeries)
                                    ? {
                                        values: requiredSeries.values,
                                        color: inflationLineColor,
                                        label: "Inflation-Adjusted Baseline",
                                        dashed: true,
                                        axis: "y",
                                    }
                                    : null,
                            });
                        },
                    },
                    {
                        id: "grossProfitPctByDay",
                        title: gpChartTitle,
                        subtitle: ("Gross profit rate for each " + (useMonthly ? "month" : "day") + ", calculated as total line-item gross profit divided by total line-item revenue and expressed as a weighted percentage.")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + latestGrossProfitPercent.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + avgGrossProfitPercent.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + " | Overall weighted: " + overallGrossProfitPercent.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedGrossProfitPercentValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendGpPercentLineColor,
                                primaryLabel: gpChartTitle,
                                maxXLabels: isThumb ? 4 : 10,
                                maxSamples: getTrendSampleLimit(isThumb),
                                curved: isThumb ? true : modalSmoothLineEnabled,
                                tension: trendCurveTension,
                                showAxes: !isThumb,
                                showLabels: !isThumb,
                                showMaxLabel: !isThumb,
                                showPoints: false,
                            });
                        },
                    },
                    {
                        id: "inventoryCostDollarByDay",
                        title: inventoryCostDollarChartTitle,
                        subtitle: hasRequiredInventoryCostSeries
                            ? ("Total non-labor line-item cost dollars summed for each " + (useMonthly ? "month" : "day") + ". The dashed line is an inflation-adjusted baseline anchored to the first 10% of the full archive timespan." + (trendNotice ? " | " + trendNotice : ""))
                            : ("Total non-labor line-item cost dollars summed for each " + (useMonthly ? "month" : "day") + " in the current filtered set." + (trendNotice ? " | " + trendNotice : "")),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": $" + latestInventoryCostDollar.toLocaleString()
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": $" + avgInventoryCostDollar.toLocaleString()
                                + " | Overall: $" + totalNonLaborCost.toLocaleString()
                                + (inventoryCostBaseline.startLabel && inventoryCostBaseline.endLabel && Number.isFinite(inventoryCostBaseline.aov)
                                    ? (" | Baseline window " + inventoryCostBaseline.startLabel + " to " + inventoryCostBaseline.endLabel + ": $" + Number(inventoryCostBaseline.aov).toLocaleString())
                                    : "")
                                + (Number.isFinite(latestRequiredInventoryCost)
                                    ? (" | Inflation-Adjusted Baseline: $" + Number(latestRequiredInventoryCost).toLocaleString())
                                    : "")
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedInventoryCostDollarValues, getTrendSampleLimit(isThumb));
                            const requiredSeriesValues = series.labels.map(function(label) {
                                const idx = dayLabels.indexOf(label);
                                return idx >= 0 ? inflationValuesByDay[idx] : null;
                            });
                            const plottedBaseline = getFirstWindowBaseline(series.labels, series.values, requiredSeriesValues, 0.1, globalAnchorRange);
                            const requiredSeries = buildRequiredAovSeries(series.values, requiredSeriesValues, plottedBaseline);
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendInventoryCostLineColor,
                                primaryLabel: inventoryCostDollarChartTitle,
                                maxXLabels: isThumb ? 4 : 10,
                                maxSamples: getTrendSampleLimit(isThumb),
                                curved: isThumb ? true : modalSmoothLineEnabled,
                                tension: trendCurveTension,
                                showAxes: !isThumb,
                                showLabels: !isThumb,
                                showMaxLabel: !isThumb,
                                showPoints: false,
                                secondarySeries: (!activeDateRange.hasDateRange && requiredSeries.hasSeries)
                                    ? {
                                        values: requiredSeries.values,
                                        color: inflationLineColor,
                                        label: "Inflation-Adjusted Baseline",
                                        dashed: true,
                                        axis: "y",
                                    }
                                    : null,
                            });
                        },
                    },
