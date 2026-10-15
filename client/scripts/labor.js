                    {
                        id: "inventoryCostToProfitByDay",
                        title: inventoryCostToSalesChartTitle,
                        subtitle: ("Non-labor line-item cost divided by total order sales for each " + (useMonthly ? "month" : "day") + ", expressed as a percentage.")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + latestInventoryCostToSalesRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + avgInventoryCostToSalesRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + " | Overall: " + overallInventoryCostToSalesRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedInventoryCostToSalesRateValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendInventoryRatioLineColor,
                                primaryLabel: inventoryCostToSalesChartTitle,
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
                        id: "itemsPerSaleByDay",
                        title: itemsPerSaleChartTitle,
                        subtitle: ("Average item quantity for each " + (useMonthly ? "month" : "day") + ", calculated as total line-item quantity divided by order count for the current filtered set.")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + latestItemsPerSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + avgItemsPerSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                + " | Overall: " + overallItemsPerSale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedItemsPerSaleValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendItemsPerSaleLineColor,
                                primaryLabel: itemsPerSaleChartTitle,
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
                        id: "laborCostByDay",
                        title: laborCostChartTitle,
                        subtitle: hasRequiredLaborCostSeries
                            ? ("Calculated labor cost summed for each " + (useMonthly ? "month" : "day") + ". Each labor line contributes cost x quantity x max(parsed labor hours, 1). The dashed line is an inflation-adjusted baseline anchored to the first 10% of the full archive timespan." + (trendNotice ? " | " + trendNotice : ""))
                            : ("Calculated labor cost summed for each " + (useMonthly ? "month" : "day") + ". Each labor line contributes cost x quantity x max(parsed labor hours, 1)." + (trendNotice ? " | " + trendNotice : "")),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": $" + latestLaborCost.toLocaleString()
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": $" + avgLaborCost.toLocaleString()
                                + " | Overall: $" + totalLaborCost.toLocaleString()
                                + (laborCostBaseline.startLabel && laborCostBaseline.endLabel && Number.isFinite(laborCostBaseline.aov)
                                    ? (" | Baseline window " + laborCostBaseline.startLabel + " to " + laborCostBaseline.endLabel + ": $" + Number(laborCostBaseline.aov).toLocaleString())
                                    : "")
                                + (Number.isFinite(latestRequiredLaborCost)
                                    ? (" | Inflation-Adjusted Baseline: $" + Number(latestRequiredLaborCost).toLocaleString())
                                    : "")
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedLaborCostValues, getTrendSampleLimit(isThumb));
                            const requiredSeriesValues = series.labels.map(function(label) {
                                const idx = dayLabels.indexOf(label);
                                return idx >= 0 ? inflationValuesByDay[idx] : null;
                            });
                            const plottedBaseline = getFirstWindowBaseline(series.labels, series.values, requiredSeriesValues, 0.1, globalAnchorRange);
                            const requiredSeries = buildRequiredAovSeries(series.values, requiredSeriesValues, plottedBaseline);
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendLaborCostLineColor,
                                primaryLabel: laborCostChartTitle,
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
                        id: "laborCostRateByDay",
                        title: laborCostRateChartTitle,
                        subtitle: ("Calculated labor cost divided by total order sales for each " + (useMonthly ? "month" : "day") + ", expressed as a percentage.")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + latestLaborCostRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + avgLaborCostRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + " | Overall: " + overallLaborCostRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%"
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedLaborCostRateValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendLaborCostRateLineColor,
                                primaryLabel: laborCostRateChartTitle,
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
                        id: "laborDurationByDay",
                        title: laborDurationChartTitle,
                        subtitle: ("Average labor duration for each " + (useMonthly ? "month" : "day") + ", using the hours parsed from LABOR serial suffixes and averaging across orders that contain measurable labor time.")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + latestLaborDuration.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "h"
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + avgLaborDuration.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "h"
                                + " | Overall: " + overallLaborDuration.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "h"
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedLaborDurationValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendLaborDurationLineColor,
                                primaryLabel: laborDurationChartTitle,
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
                        id: "newCustomersByDay",
                        title: newCustomersChartTitle,
                        subtitle: ("Count of customers whose first recorded order in the current filtered set falls in each " + (useMonthly ? "month" : "day") + ".")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + Number(latestNewCustomers).toLocaleString(undefined, { maximumFractionDigits: 1 })
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + Number(avgNewCustomers).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                + " | Overall unique: " + Number(overallNewCustomers).toLocaleString()
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedNewCustomersValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendNewCustomersLineColor,
                                primaryLabel: newCustomersChartTitle,
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
                ];
            }

