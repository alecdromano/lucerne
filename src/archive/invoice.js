const { parseMoneyCents, centsToMoney } = require("../common/money.js");

function formatInvoiceStatus(statusCode) {
    const code = String(statusCode ?? "").trim().toUpperCase();
    if (code === "P") return "Posted";
    if (code === "S" || code === "U") return "Unposted";
    if (code === "V") return "Void";
    return "Other";
}

function parseAmount(value) {
    return centsToMoney(parseMoneyCents(value));
}

function parseNumber(value) {
    const raw = String(value ?? "").replace(/,/g, "").trim();
    if (!raw) return 0;
    const num = Number.parseFloat(raw);
    return Number.isFinite(num) ? num : 0;
}

function normalizeToIsoDate(value) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!match) return "";
    let year = Number.parseInt(match[3], 10);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const month = String(Number.parseInt(match[1], 10)).padStart(2, "0");
    const day = String(Number.parseInt(match[2], 10)).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function daysBetween(isoDateA, isoDateB) {
    if (!isoDateA || !isoDateB) return null;
    const a = new Date(`${isoDateA}T00:00:00Z`);
    const b = new Date(`${isoDateB}T00:00:00Z`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
    return Math.ceil(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function pickCustomerAddressLines(order, nonEmptyString) {
    const lines = [];
    const name = nonEmptyString(order.CUST_NAME);
    const addr1 = nonEmptyString(order.CUST_ADDR);
    const addr2 = nonEmptyString(order.CUST_ADDR2);
    const city = nonEmptyString(order.CUST_CITY);
    const state = nonEmptyString(order.CUST_STATE);
    const zip = nonEmptyString(order.CUST_ZIP);
    const homePhone = nonEmptyString(order.HOME_PHONE);
    const workPhone = nonEmptyString(order.WORK_PHONE);
    const cellPhone = nonEmptyString(order.CELL_PHONE);
    const email = nonEmptyString(order.EMAIL_ADDR);

    if (name) lines.push(name);
    if (addr1) lines.push(addr1);
    if (addr2) lines.push(addr2);
    const cityLine = [city, state, zip].filter(Boolean).join(", ");
    if (cityLine) lines.push(cityLine);

    const contactLines = [];
    if (homePhone) contactLines.push(`Home: ${homePhone}`);
    if (workPhone) contactLines.push(`Work: ${workPhone}`);
    if (cellPhone) contactLines.push(`Cell: ${cellPhone}`);
    if (email) contactLines.push(`Email: ${email}`);
    if (contactLines.length) lines.push(...contactLines);

    return lines;
}

module.exports = {
    formatInvoiceStatus,
    parseAmount,
    parseNumber,
    normalizeToIsoDate,
    daysBetween,
    pickCustomerAddressLines,
};
