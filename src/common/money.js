function parseMoneyCents(value) {
    if (value == null) return 0;
    const raw = String(value).replace(/[$,]/g, "").trim();
    if (!raw) return 0;
    const match = raw.match(/^([+-]?)(?:(\d+)(?:\.(\d+))?|\.(\d+))$/);
    if (!match) {
        const floatVal = Number.parseFloat(raw);
        if (!Number.isFinite(floatVal)) return 0;
        return Math.round(floatVal * 100);
    }
    const sign = match[1] === "-" ? -1 : 1;
    const wholeStr = match[2] || "0";
    const fracStr = (match[3] || match[4] || "").padEnd(2, "0").slice(0, 3);
    const whole = Number.parseInt(wholeStr, 10);
    let cents = Number.parseInt(fracStr.slice(0, 2), 10);
    if (fracStr.length > 2 && Number.parseInt(fracStr[2], 10) >= 5) {
        cents += 1;
    }
    return sign * (whole * 100 + cents);
}

function centsToMoney(cents) {
    if (!Number.isFinite(cents)) return 0;
    return cents / 100;
}

function formatMoney(centsOrDollars, isCents = false) {
    if (centsOrDollars == null) return "";
    const cents = isCents ? Math.round(centsOrDollars) : Math.round(Number(centsOrDollars) * 100);
    if (!Number.isFinite(cents)) return "";
    const sign = cents < 0 ? "-" : "";
    const abs = Math.abs(cents);
    const whole = Math.floor(abs / 100);
    const fraction = String(abs % 100).padStart(2, "0");
    return `${sign}${whole}.${fraction}`;
}

function addMoney(...amounts) {
    let totalCents = 0;
    for (const a of amounts) {
        totalCents += parseMoneyCents(a);
    }
    return totalCents / 100;
}

function subtractMoney(a, b) {
    return (parseMoneyCents(a) - parseMoneyCents(b)) / 100;
}

module.exports = {
    parseMoneyCents,
    centsToMoney,
    formatMoney,
    addMoney,
    subtractMoney,
};
