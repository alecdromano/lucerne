function drawBarChart(canvas, labels, values, options) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const plot = { left: 48, right: width - 14, top: 18, bottom: height - 30 };
    drawAxes(ctx, width, height, plot);

    const maxVal = Math.max(1, ...values);
    const count = Math.max(values.length, 1);
    const slot = (plot.right - plot.left) / count;
    const barWidth = Math.max(6, slot * 0.6);

    for (let i = 0; i < values.length; i += 1) {
        const h = (Number(values[i] || 0) / maxVal) * (plot.bottom - plot.top);
        const x = plot.left + (slot * i) + ((slot - barWidth) / 2);
        const y = plot.bottom - h;
        ctx.fillStyle = options.color || "#3f7fbf";
        ctx.fillRect(x, y, barWidth, h);
    }

    ctx.fillStyle = "#5a7288";
    ctx.font = "11px Segoe UI, sans-serif";
    const labelIndexes = clipLabels(labels, options.maxXLabels || 6);
    for (let i = 0; i < labelIndexes.length; i += 1) {
        const idx = labelIndexes[i];
        const label = labels[idx] || "";
        const x = plot.left + (slot * idx) + (slot * 0.2);
        ctx.fillText(label, x, height - 12);
    }

    ctx.fillStyle = "#2d4358";
    ctx.fillText(formatCompact(maxVal), 6, plot.top + 2);
}

function drawDonutChart(canvas, labels, values, options) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const total = values.reduce(function(sum, v) { return sum + Number(v || 0); }, 0);
    const showLegend = options.showLegend !== false;
    const centerX = showLegend ? Math.floor(width * 0.32) : Math.floor(width * 0.5);
    const centerY = Math.floor(height * 0.5);
    const radius = Math.min(width, height) * (showLegend ? 0.28 : 0.34);
    const inner = radius * 0.62;
    const palette = options.palette || ["#2c73b8", "#8eb7de", "#c6dbef", "#4a90d0"];

    let start = -Math.PI / 2;
    for (let i = 0; i < values.length; i += 1) {
        const fraction = total > 0 ? Number(values[i] || 0) / total : 0;
        const end = start + (fraction * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.fillStyle = palette[i % palette.length];
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.closePath();
        ctx.fill();
        start = end;
    }

    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.arc(centerX, centerY, inner, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2b4359";
    ctx.font = "700 14px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(total.toLocaleString(), centerX, centerY + 4);
    ctx.textAlign = "left";

    if (showLegend) {
        ctx.font = "11px Segoe UI, sans-serif";
        for (let i = 0; i < labels.length; i += 1) {
            const y = 20 + (i * 16);
            ctx.fillStyle = palette[i % palette.length];
            ctx.fillRect(width * 0.56, y - 8, 10, 10);
            ctx.fillStyle = "#385269";
            const value = Number(values[i] || 0);
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            ctx.fillText(labels[i] + " " + value.toLocaleString() + " (" + pct + "%)", (width * 0.56) + 14, y);
        }
    }
}

function withAlpha(hexColor, alpha) {
    const color = String(hexColor || "").trim();
    const safeAlpha = Number.isFinite(Number(alpha)) ? Number(alpha) : 1;

    const shortHexMatch = color.match(/^#([0-9a-fA-F]{3})$/);
    if (shortHexMatch) {
        const h = shortHexMatch[1];
        const r = Number.parseInt(h[0] + h[0], 16);
        const g = Number.parseInt(h[1] + h[1], 16);
        const b = Number.parseInt(h[2] + h[2], 16);
        return "rgba(" + r + "," + g + "," + b + "," + safeAlpha + ")";
    }

    const fullHexMatch = color.match(/^#([0-9a-fA-F]{6})$/);
    if (fullHexMatch) {
        const hex = fullHexMatch[1];
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        return "rgba(" + r + "," + g + "," + b + "," + safeAlpha + ")";
    }

    const rgbMatch = color.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i);
    if (rgbMatch) {
        const r = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[1]))));
        const g = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[2]))));
        const b = Math.max(0, Math.min(255, Math.round(Number(rgbMatch[3]))));
        return "rgba(" + r + "," + g + "," + b + "," + safeAlpha + ")";
    }

    const modernRgbMatch = color.match(/^rgba?\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*[0-9.]+)?\s*\)$/i);
    if (modernRgbMatch) {
        const r = Math.max(0, Math.min(255, Math.round(Number(modernRgbMatch[1]))));
        const g = Math.max(0, Math.min(255, Math.round(Number(modernRgbMatch[2]))));
        const b = Math.max(0, Math.min(255, Math.round(Number(modernRgbMatch[3]))));
        return "rgba(" + r + "," + g + "," + b + "," + safeAlpha + ")";
    }

    try {
        const probe = document.createElement("span");
        probe.style.color = color;
        probe.style.display = "none";
        document.body.appendChild(probe);
        const resolved = String(window.getComputedStyle(probe).color || "").trim();
        probe.remove();
        const resolvedMatch = resolved.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i)
            || resolved.match(/^rgba?\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*[0-9.]+)?\s*\)$/i);
        if (resolvedMatch) {
            const r = Math.max(0, Math.min(255, Math.round(Number(resolvedMatch[1]))));
            const g = Math.max(0, Math.min(255, Math.round(Number(resolvedMatch[2]))));
            const b = Math.max(0, Math.min(255, Math.round(Number(resolvedMatch[3]))));
            return "rgba(" + r + "," + g + "," + b + "," + safeAlpha + ")";
        }
    } catch (error) {
        // Fall through to returning original color.
    }

    return color;
}

function drawRingSeries(ctx, centerX, centerY, radius, thickness, values, colors, trackColor) {
    const total = values.reduce(function(sum, v) { return sum + Number(v || 0); }, 0);
    ctx.lineCap = "butt";

    ctx.beginPath();
    ctx.strokeStyle = trackColor || "#e3ecf6";
    ctx.lineWidth = thickness;
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    if (!total) return;

    let start = -Math.PI / 2;
    for (let i = 0; i < values.length; i += 1) {
        const value = Number(values[i] || 0);
        if (value <= 0) continue;
        const end = start + ((value / total) * Math.PI * 2);
        ctx.beginPath();
        ctx.strokeStyle = colors[i] || "#2c73b8";
        ctx.lineWidth = thickness;
        ctx.arc(centerX, centerY, radius, start, end);
        ctx.stroke();
        start = end;
    }
}

