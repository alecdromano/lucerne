
                if (activeDateRange.hasDateRange) {
                    if (useMonthly) {
                        const rangeStartMonth = activeDateRange.rangeStart ? activeDateRange.rangeStart.slice(0, 7) : "";
                        const rangeEndMonth = activeDateRange.rangeEnd ? activeDateRange.rangeEnd.slice(0, 7) : "";
                        periodKeys = periodKeys.filter(function(periodKey) {
                            if (rangeStartMonth && periodKey < rangeStartMonth) return false;
                            if (rangeEndMonth && periodKey > rangeEndMonth) return false;
                            return true;
                        });
                    } else {
                        const rangeStartDay = activeDateRange.rangeStart;
                        const rangeEndDay = activeDateRange.rangeEnd;
                        periodKeys = periodKeys.filter(function(periodKey) {
                            if (rangeStartDay && periodKey < rangeStartDay) return false;
                            if (rangeEndDay && periodKey > rangeEndDay) return false;
                            return true;
                        });
                    }
                }

                const noticeParts = [];
                if (excludeEdgeMonths) {
                    if (edgeBucketNotice) {
                        noticeParts.push(edgeBucketNotice);
                    } else if (useMonthly) {
                        noticeParts.push("edge month exclusion enabled (no edge months met exclusion threshold)");
                    } else {
                        noticeParts.push("edge month exclusion enabled (applies in monthly view)");
                    }
                }
                if (hasNonDateFiltersActive()) noticeParts.push("filters active (chart is filtered)");
                const trendNotice = noticeParts.length ? ("Notice: " + noticeParts.join("; ")) : "";

                const dayLabels = periodKeys.map(function(d) { return d; });
                const aovValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period && period.count ? Math.round(period.revenue / period.count) : 0;
                });
                const dailySalesValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Math.round(period.revenue) : 0;
                });
                const dailyOrderCountValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Number(period.count || 0) : 0;
                });
                const itemsPerSaleValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    const count = Number(period && period.count ? period.count : 0);
                    const itemQty = Number(period && period.itemQty ? period.itemQty : 0);
                    if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(itemQty)) return 0;
                    return Number((itemQty / count).toFixed(2));
                });
                const laborDurationValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    const laborInvoices = Number(period && period.laborInvoices ? period.laborInvoices : 0);
                    const laborDuration = Number(period && period.laborDuration ? period.laborDuration : 0);
                    if (!Number.isFinite(laborInvoices) || laborInvoices <= 0 || !Number.isFinite(laborDuration)) return 0;
                    return Number((laborDuration / laborInvoices).toFixed(2));
                });
                const laborCostValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Math.round(Number(period.laborCost || 0)) : 0;
                });
                const laborCostRateValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    const laborCost = Number(period && period.laborCost ? period.laborCost : 0);
                    const sales = Number(period && period.revenue ? period.revenue : 0);
                    if (!Number.isFinite(laborCost) || !Number.isFinite(sales) || sales <= 0) return 0;
                    return Number(((laborCost / sales) * 100).toFixed(1));
                });
                const inventoryCostDollarValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Math.round(Number(period.nonLaborCost || 0)) : 0;
                });
                const inventoryCostToSalesRateValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    const nonLaborCost = Number(period && period.nonLaborCost ? period.nonLaborCost : 0);
                    const sales = Number(period && period.revenue ? period.revenue : 0);
                    if (!Number.isFinite(nonLaborCost) || !Number.isFinite(sales) || sales <= 0) return 0;
                    return Number(((nonLaborCost / sales) * 100).toFixed(1));
                });
                const grossProfitDollarValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Math.round(Number(period.gpProfit || 0)) : 0;
                });
                const integrityValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Number(period.integrity || 0) : 0;
                });
                const forgetfulnessValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Number(period.forgetfulness || 0) : 0;
                });
                const grossProfitPercentValues = periodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    const gpRevenue = Number(period && period.gpRevenue ? period.gpRevenue : 0);
                    const gpProfit = Number(period && period.gpProfit ? period.gpProfit : 0);
                    if (!Number.isFinite(gpRevenue) || gpRevenue <= 0 || !Number.isFinite(gpProfit)) return 0;
                    return Number(((gpProfit / gpRevenue) * 100).toFixed(1));
                });
                const newCustomersByPeriod = new Map();
                for (let i = 0; i < periodKeys.length; i += 1) {
                    newCustomersByPeriod.set(periodKeys[i], 0);
                }
                const seenCustomers = new Set();
                customerEvents.sort(function(a, b) {
                    const dateCmp = String(a.invoiceDateIso || a.dayKey).localeCompare(String(b.invoiceDateIso || b.dayKey));
                    if (dateCmp !== 0) return dateCmp;
                    return String(a.orderNumber || "").localeCompare(String(b.orderNumber || ""));
                });
                for (let i = 0; i < customerEvents.length; i += 1) {
                    const evt = customerEvents[i];
                    if (seenCustomers.has(evt.customerKey)) continue;
                    seenCustomers.add(evt.customerKey);
                    const periodKey = useMonthly ? String(evt.dayKey || "").slice(0, 7) : String(evt.dayKey || "");
                    if (!newCustomersByPeriod.has(periodKey)) continue;
                    newCustomersByPeriod.set(periodKey, Number(newCustomersByPeriod.get(periodKey) || 0) + 1);
                }
                const newCustomersValues = periodKeys.map(function(periodKey) {
                    return Number(newCustomersByPeriod.get(periodKey) || 0);
                });

                const clampedAovValues = clampSeriesOutliers(aovValues);
                const clampedDailySalesValues = clampSeriesOutliers(dailySalesValues);
                const clampedDailyOrderCountValues = clampSeriesOutliers(dailyOrderCountValues);
                const clampedItemsPerSaleValues = clampSeriesOutliers(itemsPerSaleValues);
                const clampedLaborDurationValues = clampSeriesOutliers(laborDurationValues);
                const clampedLaborCostValues = clampSeriesOutliers(laborCostValues);
                const clampedLaborCostRateValues = clampSeriesOutliers(laborCostRateValues);
                const clampedInventoryCostDollarValues = clampSeriesOutliers(inventoryCostDollarValues);
                const clampedInventoryCostToSalesRateValues = clampSeriesOutliers(inventoryCostToSalesRateValues);
                const clampedNewCustomersValues = clampSeriesOutliers(newCustomersValues);
                const clampedGrossProfitDollarValues = clampSeriesOutliers(grossProfitDollarValues);
                const clampedGrossProfitPercentValues = clampSeriesOutliers(grossProfitPercentValues);
                const clampedIntegrityValues = clampSeriesOutliers(integrityValues);
                const clampedForgetfulnessValues = clampSeriesOutliers(forgetfulnessValues);
                const inflationValuesByDay = periodKeys.map(function(periodKey) {
                    const monthKey = periodKey.slice(0, 7);
                    const value = Number(inflationByMonth[monthKey]);
                    return Number.isFinite(value) ? value : null;
                });

                const rawBaseline = getFirstWindowBaseline(dayLabels, clampedAovValues, inflationValuesByDay, 0.1, globalAnchorRange);
                const requiredAovRaw = buildRequiredAovSeries(clampedAovValues, inflationValuesByDay, rawBaseline);
                const hasRequiredSeries = requiredAovRaw.hasSeries;
                const overallAov = totalOrders ? Math.round(totalRevenue / totalOrders) : 0;
                const latestAov = clampedAovValues.length ? clampedAovValues[clampedAovValues.length - 1] : 0;
                const latestRequiredAov = hasRequiredSeries
                    ? requiredAovRaw.values[requiredAovRaw.values.length - 1]
                    : null;

                const curvePeriodKeyIndex = new Map();
                for (let i = 0; i < curvePeriodKeys.length; i += 1) {
                    curvePeriodKeyIndex.set(curvePeriodKeys[i], i);
                }
                const fullDailySalesValues = curvePeriodKeys.map(function(periodKey) {
                    const period = byPeriod.get(periodKey);
                    return period ? Math.round(period.revenue) : 0;
                });
                const fullClampedDailySalesValues = clampSeriesOutliers(fullDailySalesValues);
                const fullInflationValuesByPeriod = curvePeriodKeys.map(function(periodKey) {
                    const monthKey = periodKey.slice(0, 7);
                    const value = Number(inflationByMonth[monthKey]);
                    return Number.isFinite(value) ? value : null;
                });
