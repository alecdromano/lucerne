function drawAxes(ctx, width, height, plot) {
    ctx.strokeStyle = "#b9cee1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(plot.left, plot.top);
    ctx.lineTo(plot.left, plot.bottom);
    ctx.lineTo(plot.right, plot.bottom);
    ctx.stroke();
}

function drawLineChart(canvas, labels, values, options) {
    options = options || {};
    const chartLib = window.Chart;
    const ctx = canvas.getContext("2d");
    if (!chartLib || !ctx) return;

    function destroyTrendChart(targetCanvas) {
        const existing = trendChartInstances.get(targetCanvas);
        if (!existing) return;
        existing.destroy();
        trendChartInstances.delete(targetCanvas);
    }

    const showAxes = options.showAxes !== false;
    const showLabels = options.showLabels !== false;
    const showMaxLabel = options.showMaxLabel !== false;
    const useCurves = options.curved !== false;
    const curveTension = Math.max(0, Math.min(1, Number(options.tension)));

    const rawLabels = Array.isArray(labels) ? labels.slice() : [];
    const rawValues = Array.isArray(values) ? values.map(function(v) { return Number(v || 0); }) : [];
    let chartLabels = rawLabels;
    let chartValues = rawValues;
    if (chartValues.length === 1) {
        const singleLabel = rawLabels[0] || "value";
        const singleValue = rawValues[0] || 0;
        chartLabels = [singleLabel, singleLabel];
        chartValues = [singleValue, singleValue];
    }

    destroyTrendChart(canvas);

    const maxXLabels = Math.max(2, Number(options.maxXLabels || 6));
    const maxSamples = Math.max(2, Number(options.maxSamples || chartValues.length));
    const xStep = Math.max(1, Math.ceil(chartLabels.length / maxXLabels));
    const lineColor = options.color || trendSalesLineColor;
    const showPoints = options.showPoints === true || (options.showPoints !== false && chartValues.length <= 120);
    const secondary = options.secondarySeries && Array.isArray(options.secondarySeries.values)
        ? options.secondarySeries
        : null;
    const secondaryAxisId = secondary && secondary.axis === "y" ? "y" : "y1";

    const datasets = [
        {
            data: chartValues,
            borderColor: lineColor,
            borderWidth: 2.6,
            cubicInterpolationMode: "monotone",
            tension: useCurves ? (Number.isFinite(curveTension) ? curveTension : 0.34) : 0,
            fill: false,
            pointRadius: showPoints ? 2 : 0,
            pointHoverRadius: showPoints ? 4 : 4,
            pointBackgroundColor: lineColor,
            pointBorderColor: lineColor,
            yAxisID: "y",
            label: options.primaryLabel || "AOV",
        },
    ];

    if (secondary) {
        const secondaryValues = secondary.values.map(function(v) {
            if (v == null || v === "") return null;
            const num = Number(v);
            return Number.isFinite(num) ? num : null;
        });
        datasets.push({
            data: secondaryValues,
            borderColor: secondary.color || inflationLineColor,
            borderWidth: 2,
            borderDash: secondary.dashed ? [6, 4] : [],
            cubicInterpolationMode: "monotone",
            tension: useCurves ? (Number.isFinite(curveTension) ? curveTension : 0.34) : 0,
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0,
            spanGaps: true,
            yAxisID: secondaryAxisId,
            label: secondary.label || "Dollar Value Index",
        });
    }

    const chart = new chartLib(ctx, {
        type: "line",
        data: {
            labels: chartLabels,
            datasets,
        },
        options: {
            // Canvases already have fixed width/height attributes; responsive resizing causes growth feedback.
            responsive: false,
            maintainAspectRatio: true,
            animation: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                legend: { display: !!secondary && showAxes },
                tooltip: { enabled: showAxes },
                decimation: {
                    enabled: chartValues.length > maxSamples,
                    algorithm: "lttb",
                    samples: maxSamples,
                },
            },
            scales: {
                x: {
                    display: showAxes,
                    grid: {
                        display: showAxes,
                        color: "#e6eef7",
                    },
                    ticks: {
                        display: showLabels,
                        autoSkip: false,
                        callback: function(value, index) {
                            return index % xStep === 0 ? this.getLabelForValue(value) : "";
                        },
                        color: "#5a7288",
                        maxRotation: 0,
                        minRotation: 0,
                    },
                },
                y: {
                    display: showAxes,
                    beginAtZero: true,
                    grace: "6%",
                    grid: {
                        display: showAxes,
                        color: "#e6eef7",
                    },
                    ticks: {
                        display: showMaxLabel,
                        color: "#5a7288",
                        callback: function(value) {
                            return formatCompact(value);
                        },
                    },
                },
                y1: {
                    display: showAxes && !!secondary && secondaryAxisId === "y1",
                    position: "right",
                    beginAtZero: false,
                    grace: "6%",
                    grid: {
                        display: false,
                    },
                    ticks: {
                        color: secondary ? (secondary.color || inflationLineColor) : inflationLineColor,
                        callback: function(value) {
                            return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
                        },
                    },
                },
            },
        },
    });

    trendChartInstances.set(canvas, chart);
}

