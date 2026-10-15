const test = require("node:test");
const assert = require("node:assert/strict");

const {
    parseMoneyCents,
    centsToMoney,
    formatMoney,
    addMoney,
    subtractMoney,
} = require("./money.js");

test("parseMoneyCents parses various currency strings correctly into integer cents", () => {
    assert.equal(parseMoneyCents("0"), 0);
    assert.equal(parseMoneyCents(""), 0);
    assert.equal(parseMoneyCents(null), 0);
    assert.equal(parseMoneyCents("19.99"), 1999);
    assert.equal(parseMoneyCents("$1,234.56"), 123456);
    assert.equal(parseMoneyCents("-45.20"), -4520);
    assert.equal(parseMoneyCents("-.50"), -50);
    assert.equal(parseMoneyCents(".99"), 99);
    assert.equal(parseMoneyCents("10"), 1000);
    assert.equal(parseMoneyCents("10.004"), 1000);
    assert.equal(parseMoneyCents("10.005"), 1001);
});

test("centsToMoney converts integer cents to decimal numbers", () => {
    assert.equal(centsToMoney(1999), 19.99);
    assert.equal(centsToMoney(0), 0);
    assert.equal(centsToMoney(-4520), -45.2);
});

test("formatMoney formats cents or dollar amounts to standard 2-decimal strings", () => {
    assert.equal(formatMoney(19.99), "19.99");
    assert.equal(formatMoney(19.9), "19.90");
    assert.equal(formatMoney(0), "0.00");
    assert.equal(formatMoney(-5.5), "-5.50");
    assert.equal(formatMoney(1999, true), "19.99");
    assert.equal(formatMoney(-550, true), "-5.50");
    assert.equal(formatMoney(null), "");
});

test("addMoney avoids floating point representation errors", () => {
    // 0.1 + 0.2 in native JS produces 0.30000000000000004
    assert.equal(addMoney(0.1, 0.2), 0.3);
    assert.equal(addMoney("19.99", "0.01", "5.00"), 25.0);
});

test("subtractMoney accurately computes balance difference", () => {
    // 1.03 - 0.42 in native JS produces 0.6100000000000001
    assert.equal(subtractMoney("1.03", "0.42"), 0.61);
    assert.equal(subtractMoney(100, 25.5), 74.5);
});
