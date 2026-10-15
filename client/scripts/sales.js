                    {
                        id: "dailySalesByDay",
                        title: salesChartTitle,
                        subtitle: hasRequiredSalesSeries
                            ? ("Total order sales summed for each " + (useMonthly ? "month" : "day") + ". The solid line is actual filtered sales. The dashed line is an inflation-adjusted baseline anchored to the first 10% of the full archive timespan." + (trendNotice ? " | " + trendNotice : ""))
                            : ("Total order sales summed for each " + (useMonthly ? "month" : "day") + " in the current filtered set." + (trendNotice ? " | " + trendNotice : "")),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": $" + latestDailySales.toLocaleString()
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": $" + avgDailySales.toLocaleString()
                                + (effectiveSalesBaseline.startLabel && effectiveSalesBaseline.endLabel && Number.isFinite(effectiveSalesBaseline.aov)
                                    ? (" | Baseline window " + effectiveSalesBaseline.startLabel + " to " + effectiveSalesBaseline.endLabel + ": $" + Number(effectiveSalesBaseline.aov).toLocaleString())
                                    : "")
                                + (Number.isFinite(latestRequiredSales) ? (" | Sales Baseline: $" + Number(latestRequiredSales).toLocaleString()) : "")
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, displayedClampedDailySalesValues, getTrendSampleLimit(isThumb));
                            const requiredSeriesValues = series.labels.map(function(label) {
                                const idx = dayLabels.indexOf(label);
                                return idx >= 0 ? displayedRequiredSalesValuesFromFull[idx] : null;
                            });
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendSalesLineColor,
                                primaryLabel: salesChartTitle,
                                maxXLabels: isThumb ? 4 : 10,
                                maxSamples: getTrendSampleLimit(isThumb),
                                curved: isThumb ? true : modalSmoothLineEnabled,
                                tension: trendCurveTension,
                                showAxes: !isThumb,
                                showLabels: !isThumb,
                                showMaxLabel: !isThumb,
                                showPoints: false,
                                secondarySeries: (!activeDateRange.hasDateRange && hasRequiredSalesSeries)
                                    ? {
                                        values: requiredSeriesValues,
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
                        id: "aovByDay",
                        title: aovChartTitle,
                        subtitle: hasRequiredSeries
                            ? ("Average sale value for each " + (useMonthly ? "month" : "day") + ", calculated as total sales divided by sale count. The dashed line is the inflation-adjusted value required to match the first 10% of the full archive timespan." + (trendNotice ? " | " + trendNotice : ""))
                            : ("Average sale value for each " + (useMonthly ? "month" : "day") + ", calculated as total sales divided by sale count for the current filtered set." + (trendNotice ? " | " + trendNotice : "")),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": $" + latestAov.toLocaleString()
                                + " | Overall: $" + overallAov.toLocaleString()
                                + (rawBaseline.startLabel && rawBaseline.endLabel && Number.isFinite(rawBaseline.aov)
                                    ? (" | Baseline window " + rawBaseline.startLabel + " to " + rawBaseline.endLabel + ": $" + Number(rawBaseline.aov).toLocaleString())
                                    : "")
                                + (Number.isFinite(latestRequiredAov) ? (" | ASV Baseline: $" + Number(latestRequiredAov).toLocaleString()) : "")
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedAovValues, getTrendSampleLimit(isThumb));
                            const requiredSeriesValues = series.labels.map(function(label) {
                                const idx = dayLabels.indexOf(label);
                                return idx >= 0 ? inflationValuesByDay[idx] : null;
                            });
                            const plottedBaseline = getFirstWindowBaseline(series.labels, series.values, requiredSeriesValues, 0.1, globalAnchorRange);
                            const requiredSeries = buildRequiredAovSeries(series.values, requiredSeriesValues, plottedBaseline);
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendAovLineColor,
                                primaryLabel: "ASV",
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
                        id: "orderCountByDay",
                        title: orderCountChartTitle,
                        subtitle: ("Count of matched orders in each " + (useMonthly ? "month" : "day") + " for the current filtered set.")
                            + (trendNotice ? " | " + trendNotice : ""),
                        meta: periodKeys.length
                            ? (
                                "Latest " + (useMonthly ? "month" : "day") + ": " + latestDailyOrderCount.toLocaleString()
                                + " | Avg " + (useMonthly ? "monthly" : "daily") + ": " + avgDailyOrderCount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
                                + (trendNotice ? (" | " + trendNotice) : "")
                            )
                            : "No dated orders in current filters",
                        render: function(canvas, isThumb) {
                            const series = downsampleSeries(dayLabels, clampedDailyOrderCountValues, getTrendSampleLimit(isThumb));
                            drawLineChart(canvas, series.labels, series.values, {
                                color: trendOrderCountLineColor,
                                primaryLabel: orderCountChartTitle,
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
