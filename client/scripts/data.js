            function getTrendDefinitions() {
                const activeDateRange = getActiveDateRange();
                const trendSourceIndices = collectMatchedIndices({ includeDateRange: false });
                const byDay = new Map();
                const customerEvents = [];
                let totalRevenue = 0;
                let totalOrders = 0;
                let totalGpProfit = 0;
                let totalGpRevenue = 0;
                let totalItemQuantity = 0;
                let totalLaborDuration = 0;
                let totalLaborDurationInvoices = 0;
                let totalLaborCost = 0;
                let totalNonLaborCost = 0;
                let totalIntegrityFlags = 0;
                let totalForgetfulnessFlags = 0;

                for (let i = 0; i < trendSourceIndices.length; i += 1) {
                    const order = orders[trendSourceIndices[i]] || {};
                    const dateIso = String(order.invoiceDateIso || "");
                    const dayKey = dateIso.length >= 10 ? dateIso.slice(0, 10) : dateIso;
                    if (!dayKey) continue;

                    const total = Number(order.totalAmount || parseAmountClient(order.total));
                    const gpProfit = Number(order.grossProfitAmount);
                    const gpRevenue = Number(order.grossProfitRevenueAmount);
                    const probableDataLoss = !!order.probableDataLoss;
                    const paymentAmount = getOrderCollectedAmount(order);
                    const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
                    const mostlyPaid = total > 0 && (paymentAmount / total) >= 0.95;
                    const neverPosted = order.statusCode !== "P" && order.statusCode !== "V";
                    const salespersonForgetfulness = mostlyPaid && neverPosted;
                    const customerKey = String(order.customerName || "").trim().toLowerCase();
                    let orderItemQuantity = 0;
                    let orderLaborDuration = 0;
                    let orderLaborCost = 0;
                    let orderNonLaborCost = 0;
                    let orderNonLaborSales = 0;
                    for (let li = 0; li < lineItems.length; li += 1) {
                        const lineItem = lineItems[li] || {};
                        const fields = lineItem.fields || {};
                        const isCommittedLine = !!lineItem.isCommitted;
                        const qtyRaw = String(fields.Qty || "").replace(/[,$\s]/g, "");
                        const qtyParsed = Number.parseFloat(qtyRaw);
                        const qty = Number.isFinite(qtyParsed) && qtyParsed > 0 ? qtyParsed : 1;
                        orderItemQuantity += qty;

                        const isLaborLine = String(fields.Make || "").trim().toUpperCase() === "LABOR";
                        const costPerUnit = parseAmountClient(fields.Cost);

                        if (!isLaborLine) {
                            const subtotal = parseAmountClient(fields.Subtotal);
                            const price = parseAmountClient(fields.Price);
                            const lineRevenue = subtotal !== 0 ? subtotal : (price * qty);
                            const lineCost = isCommittedLine ? (costPerUnit * qty) : costPerUnit;
                            if (Number.isFinite(lineRevenue) && Number.isFinite(lineCost)) {
                                orderNonLaborCost += lineCost;
                                orderNonLaborSales += lineRevenue;
                            }
                        }

                        if (!isLaborLine) continue;

                        const serialRaw = String(fields.Serial || "");
                        const durationMatch = serialRaw.match(/;\s*([0-9]+(?:\.[0-9]+)?)/);
                        const durationHours = durationMatch ? Number.parseFloat(durationMatch[1]) : NaN;
                        const laborHoursMultiplier = Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 1;
                        if (Number.isFinite(durationHours) && durationHours >= 0) {
                            orderLaborDuration += durationHours;
                        }
                        const laborBaseCost = isCommittedLine ? (costPerUnit * qty) : costPerUnit;
                        const laborLineCost = laborBaseCost * laborHoursMultiplier;
                        if (Number.isFinite(laborLineCost)) {
                            orderLaborCost += laborLineCost;
                        }
                    }
                    const hasLaborDuration = orderLaborDuration > 0;

                    const prev = byDay.get(dayKey) || { count: 0, revenue: 0, gpProfit: 0, gpRevenue: 0, itemQty: 0, laborDuration: 0, laborCost: 0, laborInvoices: 0, nonLaborCost: 0, nonLaborSales: 0, integrity: 0, forgetfulness: 0 };
                    prev.count += 1;
                    prev.revenue += total;
                    prev.itemQty += orderItemQuantity;
                    prev.laborCost += orderLaborCost;
                    if (hasLaborDuration) {
                        prev.laborDuration += orderLaborDuration;
                        prev.laborInvoices += 1;
                    }
                    prev.nonLaborCost += orderNonLaborCost;
                    prev.nonLaborSales += orderNonLaborSales;
                    prev.integrity += probableDataLoss ? 1 : 0;
                    prev.forgetfulness += salespersonForgetfulness ? 1 : 0;
                    if (Number.isFinite(gpProfit) && Number.isFinite(gpRevenue) && gpRevenue > 0) {
                        prev.gpProfit += gpProfit;
                        prev.gpRevenue += gpRevenue;
                        totalGpProfit += gpProfit;
                        totalGpRevenue += gpRevenue;
                    }
                    byDay.set(dayKey, prev);

                    if (customerKey) {
                        customerEvents.push({
                            dayKey,
                            customerKey,
                            invoiceDateIso: String(order.invoiceDateIso || ""),
                            orderNumber: getOrderNumber(order),
                        });
                    }

                    totalRevenue += total;
                    totalItemQuantity += orderItemQuantity;
                    totalLaborCost += orderLaborCost;
                    if (hasLaborDuration) {
                        totalLaborDuration += orderLaborDuration;
                        totalLaborDurationInvoices += 1;
                    }
                    totalNonLaborCost += orderNonLaborCost;
                    totalIntegrityFlags += probableDataLoss ? 1 : 0;
                    totalForgetfulnessFlags += salespersonForgetfulness ? 1 : 0;
                    totalOrders += 1;
                }

                const dayKeys = Array.from(byDay.keys()).sort();
                const minDayKey = dayKeys.length ? dayKeys[0] : "";
                const maxDayKey = dayKeys.length ? dayKeys[dayKeys.length - 1] : "";
                const minTs = minDayKey ? Date.parse(minDayKey + "T00:00:00Z") : NaN;
                const maxTs = maxDayKey ? Date.parse(maxDayKey + "T00:00:00Z") : NaN;
                const allOrderDayKeys = orders.map(function(order) {
                    const dateIso = String((order && order.invoiceDateIso) || "");
                    return dateIso.length >= 10 ? dateIso.slice(0, 10) : "";
                }).filter(Boolean).sort();
                const globalMinDayKey = allOrderDayKeys.length ? allOrderDayKeys[0] : "";
                const globalMaxDayKey = allOrderDayKeys.length ? allOrderDayKeys[allOrderDayKeys.length - 1] : "";
                const globalAnchorRange = {
                    startTs: globalMinDayKey ? Date.parse(globalMinDayKey + "T00:00:00Z") : NaN,
                    endTs: globalMaxDayKey ? Date.parse(globalMaxDayKey + "T00:00:00Z") : NaN,
                };
                const spanDays = Number.isFinite(minTs) && Number.isFinite(maxTs)
                    ? Math.max(0, Math.round((maxTs - minTs) / 86400000))
                    : 0;
                const activeStartTs = activeDateRange.rangeStart ? Date.parse(activeDateRange.rangeStart + "T00:00:00Z") : NaN;
                const activeEndTs = activeDateRange.rangeEnd ? Date.parse(activeDateRange.rangeEnd + "T00:00:00Z") : NaN;
                const visibleStartTs = Number.isFinite(activeStartTs) ? activeStartTs : minTs;
                const visibleEndTs = Number.isFinite(activeEndTs) ? activeEndTs : maxTs;
                const visibleSpanDays = Number.isFinite(visibleStartTs) && Number.isFinite(visibleEndTs)
                    ? Math.max(0, Math.round((visibleEndTs - visibleStartTs) / 86400000))
                    : spanDays;
                const useMonthly = activeDateRange.hasDateRange
                    ? (visibleSpanDays >= 180)
                    : (spanDays > 365);

                const byPeriod = new Map();
                for (let i = 0; i < dayKeys.length; i += 1) {
                    const dayKey = dayKeys[i];
                    const periodKey = useMonthly ? dayKey.slice(0, 7) : dayKey;
                    const day = byDay.get(dayKey) || { count: 0, revenue: 0, gpProfit: 0, gpRevenue: 0, itemQty: 0, laborDuration: 0, laborCost: 0, laborInvoices: 0, nonLaborCost: 0, nonLaborSales: 0, integrity: 0, forgetfulness: 0 };
                    const prev = byPeriod.get(periodKey) || { count: 0, revenue: 0, gpProfit: 0, gpRevenue: 0, itemQty: 0, laborDuration: 0, laborCost: 0, laborInvoices: 0, nonLaborCost: 0, nonLaborSales: 0, integrity: 0, forgetfulness: 0 };
                    prev.count += Number(day.count || 0);
                    prev.revenue += Number(day.revenue || 0);
                    prev.gpProfit += Number(day.gpProfit || 0);
                    prev.gpRevenue += Number(day.gpRevenue || 0);
                    prev.itemQty += Number(day.itemQty || 0);
                    prev.laborDuration += Number(day.laborDuration || 0);
                    prev.laborCost += Number(day.laborCost || 0);
                    prev.laborInvoices += Number(day.laborInvoices || 0);
                    prev.nonLaborCost += Number(day.nonLaborCost || 0);
                    prev.nonLaborSales += Number(day.nonLaborSales || 0);
                    prev.integrity += Number(day.integrity || 0);
                    prev.forgetfulness += Number(day.forgetfulness || 0);
                    byPeriod.set(periodKey, prev);
                }

                const originalPeriodKeys = Array.from(byPeriod.keys()).sort();
                let periodKeys = originalPeriodKeys.slice();
                let edgeBucketNotice = "";

                if (excludeEdgeMonths && useMonthly && periodKeys.length >= 3) {
                    const counts = periodKeys.map(function(periodKey) {
                        const period = byPeriod.get(periodKey);
                        return Number(period && period.count ? period.count : 0);
                    }).filter(function(count) {
                        return Number.isFinite(count) && count > 0;
                    });

                    const avgMonthlyCount = counts.length
                        ? counts.reduce(function(sum, value) { return sum + value; }, 0) / counts.length
                        : 0;
                    const threshold = avgMonthlyCount * 0.1;
                    const removed = [];

                    if (avgMonthlyCount > 0) {
                        const firstKey = periodKeys[0];
                        const firstPeriod = byPeriod.get(firstKey) || { count: 0 };
                        const firstCount = Number(firstPeriod.count || 0);
                        if (firstCount <= threshold) {
                            removed.push(firstKey);
                            periodKeys = periodKeys.slice(1);
                        }

                        if (periodKeys.length) {
                            const lastKey = periodKeys[periodKeys.length - 1];
                            const lastPeriod = byPeriod.get(lastKey) || { count: 0 };
                            const lastCount = Number(lastPeriod.count || 0);
                            if (lastCount <= threshold) {
                                removed.push(lastKey);
                                periodKeys = periodKeys.slice(0, -1);
                            }
                        }
                    }

                    if (!periodKeys.length) {
                        periodKeys = originalPeriodKeys;
                    }

                    if (removed.length) {
                        edgeBucketNotice = "excluded edge month" + (removed.length > 1 ? "s" : "")
                            + " " + removed.join(" and ")
                            + " (<=10% of avg monthly count)";
                    }
                }

                const curvePeriodKeys = periodKeys.slice();
