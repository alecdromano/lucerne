                const displayedClampedDailySalesValues = dayLabels.map(function(label) {
                    const idx = curvePeriodKeyIndex.get(label);
                    return idx === undefined ? 0 : Number(fullClampedDailySalesValues[idx] || 0);
                });
                const salesBaseline = getFirstWindowBaseline(curvePeriodKeys, fullClampedDailySalesValues, fullInflationValuesByPeriod, 0.1, globalAnchorRange);
                const fallbackSalesBaseline = useMonthly ? globalSalesBaselines.monthly : globalSalesBaselines.daily;
                const effectiveSalesBaseline = hasValidBaseline(salesBaseline)
                    ? salesBaseline
                    : (hasValidBaseline(fallbackSalesBaseline) ? fallbackSalesBaseline : salesBaseline);
                const requiredSalesRaw = buildRequiredAovSeries(fullClampedDailySalesValues, fullInflationValuesByPeriod, effectiveSalesBaseline);
                const hasRequiredSalesSeries = requiredSalesRaw.hasSeries;
                const displayedRequiredSalesValuesFromFull = dayLabels.map(function(label) {
                    const idx = curvePeriodKeyIndex.get(label);
                    return idx === undefined ? null : requiredSalesRaw.values[idx];
                });
                const periodCount = periodKeys.length;
                const avgDailySales = periodCount
                    ? Math.round(displayedClampedDailySalesValues.reduce(function(sum, value) { return sum + Number(value || 0); }, 0) / periodCount)
                    : 0;
                const latestDailySales = displayedClampedDailySalesValues.length ? displayedClampedDailySalesValues[displayedClampedDailySalesValues.length - 1] : 0;
                const latestRequiredSales = hasRequiredSalesSeries
                    ? displayedRequiredSalesValuesFromFull[displayedRequiredSalesValuesFromFull.length - 1]
                    : null;

                const grossProfitDollarBaseline = getFirstWindowBaseline(dayLabels, clampedGrossProfitDollarValues, inflationValuesByDay, 0.1, globalAnchorRange);
                const requiredGrossProfitDollarRaw = buildRequiredAovSeries(clampedGrossProfitDollarValues, inflationValuesByDay, grossProfitDollarBaseline);
                const hasRequiredGrossProfitDollarSeries = requiredGrossProfitDollarRaw.hasSeries;
                const avgDailyOrderCount = periodCount ? Math.round((totalOrders / periodCount) * 10) / 10 : 0;
                const avgItemsPerSale = periodCount
                    ? Number((clampedItemsPerSaleValues.reduce(function(sum, value) { return sum + Number(value || 0); }, 0) / periodCount).toFixed(2))
                    : 0;
                const avgGrossProfitDollar = periodCount ? Math.round(totalGpProfit / periodCount) : 0;
                const latestDailyOrderCount = clampedDailyOrderCountValues.length ? clampedDailyOrderCountValues[clampedDailyOrderCountValues.length - 1] : 0;
                const latestItemsPerSale = clampedItemsPerSaleValues.length ? Number(clampedItemsPerSaleValues[clampedItemsPerSaleValues.length - 1] || 0) : 0;
                const latestLaborDuration = clampedLaborDurationValues.length ? Number(clampedLaborDurationValues[clampedLaborDurationValues.length - 1] || 0) : 0;
                const latestLaborCost = clampedLaborCostValues.length ? Number(clampedLaborCostValues[clampedLaborCostValues.length - 1] || 0) : 0;
                const latestLaborCostRate = clampedLaborCostRateValues.length ? Number(clampedLaborCostRateValues[clampedLaborCostRateValues.length - 1] || 0) : 0;
                const latestInventoryCostDollar = clampedInventoryCostDollarValues.length ? Number(clampedInventoryCostDollarValues[clampedInventoryCostDollarValues.length - 1] || 0) : 0;
                const latestInventoryCostToSalesRate = clampedInventoryCostToSalesRateValues.length ? Number(clampedInventoryCostToSalesRateValues[clampedInventoryCostToSalesRateValues.length - 1] || 0) : 0;
                const latestNewCustomers = clampedNewCustomersValues.length ? Number(clampedNewCustomersValues[clampedNewCustomersValues.length - 1] || 0) : 0;
                const latestIntegrityCount = clampedIntegrityValues.length ? clampedIntegrityValues[clampedIntegrityValues.length - 1] : 0;
                const latestForgetfulnessCount = clampedForgetfulnessValues.length ? clampedForgetfulnessValues[clampedForgetfulnessValues.length - 1] : 0;
                const latestGrossProfitDollar = clampedGrossProfitDollarValues.length ? clampedGrossProfitDollarValues[clampedGrossProfitDollarValues.length - 1] : 0;
                const latestRequiredGrossProfitDollar = hasRequiredGrossProfitDollarSeries
                    ? requiredGrossProfitDollarRaw.values[requiredGrossProfitDollarRaw.values.length - 1]
                    : null;
                const overallGrossProfitPercent = totalGpRevenue > 0
                    ? Number(((totalGpProfit / totalGpRevenue) * 100).toFixed(1))
                    : 0;
                const latestGrossProfitPercent = clampedGrossProfitPercentValues.length
                    ? Number(clampedGrossProfitPercentValues[clampedGrossProfitPercentValues.length - 1] || 0)
                    : 0;
                const avgGrossProfitPercent = clampedGrossProfitPercentValues.length
                    ? Number((clampedGrossProfitPercentValues.reduce(function(sum, value) { return sum + Number(value || 0); }, 0) / clampedGrossProfitPercentValues.length).toFixed(1))
                    : 0;
                const gpChartTitle = useMonthly ? "Monthly Gross Profit Rate" : "Daily Gross Profit %";
                const gpDollarChartTitle = useMonthly ? "Monthly Gross Profit" : "Daily Gross Profit $";
                const salesChartTitle = useMonthly ? "Monthly Sales" : "Daily Sales";
                const orderCountChartTitle = useMonthly ? "Monthly Sale Count" : "Daily Sale Count";
                const itemsPerSaleChartTitle = useMonthly ? "Monthly Average Item Quantity" : "Daily Average Item Quantity";
                const laborDurationChartTitle = useMonthly ? "Monthly Average Labor Duration" : "Daily Average Labor Duration";
                const laborCostChartTitle = useMonthly ? "Monthly Labor Cost" : "Daily Labor Cost";
                const laborCostRateChartTitle = useMonthly ? "Monthly Labor Cost Rate" : "Daily Labor Cost Rate";
                const newCustomersChartTitle = useMonthly ? "Monthly New Customers" : "Daily New Customers";
                const inventoryCostDollarChartTitle = useMonthly ? "Monthly Item Cost" : "Daily Item Cost";
                const inventoryCostToSalesChartTitle = useMonthly ? "Monthly Item Cost Rate" : "Daily Item Cost Rate";
                const aovChartTitle = useMonthly ? "Monthly Average Sale Value" : "Daily Average Sale Value";
                const dataIntegrityChartTitle = useMonthly ? "Monthly Data Integrity" : "Daily Data Integrity";
                const forgetfulnessChartTitle = useMonthly ? "Monthly Salesperson Forgetfulness" : "Daily Salesperson Forgetfulness";
                const overallItemsPerSale = totalOrders > 0 ? Number((totalItemQuantity / totalOrders).toFixed(2)) : 0;
                const overallLaborDuration = totalLaborDurationInvoices > 0
                    ? Number((totalLaborDuration / totalLaborDurationInvoices).toFixed(2))
                    : 0;
                const laborPeriodsWithData = periodKeys.reduce(function(count, periodKey) {
                    const period = byPeriod.get(periodKey);
                    return count + (Number(period && period.laborInvoices ? period.laborInvoices : 0) > 0 ? 1 : 0);
                }, 0);
                const avgLaborDuration = laborPeriodsWithData > 0
                    ? Number((clampedLaborDurationValues.reduce(function(sum, value, index) {
                        const period = byPeriod.get(periodKeys[index]);
                        const hasLabor = Number(period && period.laborInvoices ? period.laborInvoices : 0) > 0;
                        return hasLabor ? (sum + Number(value || 0)) : sum;
                    }, 0) / laborPeriodsWithData).toFixed(2))
                    : 0;
                const avgLaborCost = periodCount
                    ? Math.round(clampedLaborCostValues.reduce(function(sum, value) { return sum + Number(value || 0); }, 0) / periodCount)
                    : 0;
                const laborCostBaseline = getFirstWindowBaseline(dayLabels, clampedLaborCostValues, inflationValuesByDay, 0.1, globalAnchorRange);
                const requiredLaborCostRaw = buildRequiredAovSeries(clampedLaborCostValues, inflationValuesByDay, laborCostBaseline);
                const hasRequiredLaborCostSeries = requiredLaborCostRaw.hasSeries;
                const latestRequiredLaborCost = hasRequiredLaborCostSeries
                    ? requiredLaborCostRaw.values[requiredLaborCostRaw.values.length - 1]
                    : null;
                const laborCostRatePeriodsWithData = periodKeys.reduce(function(count, periodKey) {
                    const period = byPeriod.get(periodKey);
                    return count + (Number(period && period.revenue ? period.revenue : 0) > 0 ? 1 : 0);
                }, 0);
                const avgLaborCostRate = laborCostRatePeriodsWithData > 0
                    ? Number((clampedLaborCostRateValues.reduce(function(sum, value, index) {
                        const period = byPeriod.get(periodKeys[index]);
                        const sales = Number(period && period.revenue ? period.revenue : 0);
                        return sales > 0 ? (sum + Number(value || 0)) : sum;
                    }, 0) / laborCostRatePeriodsWithData).toFixed(1))
                    : 0;
                const overallLaborCostRate = totalRevenue > 0
                    ? Number((((totalLaborCost / totalRevenue) * 100)).toFixed(1))
                    : 0;
                const avgInventoryCostDollar = periodCount
                    ? Math.round(clampedInventoryCostDollarValues.reduce(function(sum, value) { return sum + Number(value || 0); }, 0) / periodCount)
                    : 0;
                const inventoryCostBaseline = getFirstWindowBaseline(dayLabels, clampedInventoryCostDollarValues, inflationValuesByDay, 0.1, globalAnchorRange);
                const requiredInventoryCostRaw = buildRequiredAovSeries(clampedInventoryCostDollarValues, inflationValuesByDay, inventoryCostBaseline);
                const hasRequiredInventoryCostSeries = requiredInventoryCostRaw.hasSeries;
                const latestRequiredInventoryCost = hasRequiredInventoryCostSeries
                    ? requiredInventoryCostRaw.values[requiredInventoryCostRaw.values.length - 1]
                    : null;
                const inventoryPeriodsWithData = periodKeys.reduce(function(count, periodKey) {
                    const period = byPeriod.get(periodKey);
                    return count + (Number(period && period.revenue ? period.revenue : 0) > 0 ? 1 : 0);
                }, 0);
                const avgInventoryCostToSalesRate = inventoryPeriodsWithData > 0
                    ? Number((clampedInventoryCostToSalesRateValues.reduce(function(sum, value, index) {
                        const period = byPeriod.get(periodKeys[index]);
                        const sales = Number(period && period.revenue ? period.revenue : 0);
                        return sales > 0 ? (sum + Number(value || 0)) : sum;
                    }, 0) / inventoryPeriodsWithData).toFixed(2))
                    : 0;
                const overallInventoryCostToSalesRate = totalRevenue > 0
                    ? Number((((totalNonLaborCost / totalRevenue) * 100)).toFixed(1))
                    : 0;

                const avgNewCustomers = periodCount
                    ? Number((clampedNewCustomersValues.reduce(function(sum, value) { return sum + Number(value || 0); }, 0) / periodCount).toFixed(1))
                    : 0;
                const overallNewCustomers = seenCustomers.size;

                return [
