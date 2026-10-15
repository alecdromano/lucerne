const test = require("node:test");
const assert = require("node:assert/strict");

const {
    formatInvoiceStatus,
    normalizeToIsoDate,
    daysBetween,
    pickCustomerAddressLines,
} = require("./invoice.js");

test("formatInvoiceStatus translates single-letter legacy codes to human labels", () => {
    assert.equal(formatInvoiceStatus("P"), "Posted");
    assert.equal(formatInvoiceStatus("p"), "Posted");
    assert.equal(formatInvoiceStatus("S"), "Unposted");
    assert.equal(formatInvoiceStatus("U"), "Unposted");
    assert.equal(formatInvoiceStatus("V"), "Void");
    assert.equal(formatInvoiceStatus(""), "Other");
    assert.equal(formatInvoiceStatus(null), "Other");
});

test("normalizeToIsoDate converts US slash and hyphen dates to ISO YYYY-MM-DD", () => {
    assert.equal(normalizeToIsoDate("04/15/2023"), "2023-04-15");
    assert.equal(normalizeToIsoDate("4/5/23"), "2023-04-05");
    assert.equal(normalizeToIsoDate("11-02-1999"), "1999-11-02");
    assert.equal(normalizeToIsoDate("invalid"), "");
    assert.equal(normalizeToIsoDate(""), "");
});

test("daysBetween computes absolute calendar day distance", () => {
    assert.equal(daysBetween("2023-01-01", "2023-01-10"), 9);
    assert.equal(daysBetween("2023-01-10", "2023-01-01"), 9);
    assert.equal(daysBetween("2023-01-01", "2023-01-01"), 0);
    assert.equal(daysBetween("2023-01-01", null), null);
    assert.equal(daysBetween(null, "2023-01-01"), null);
});

test("pickCustomerAddressLines extracts formatted non-empty address and contact lines", () => {
    const mockOrder = {
        CUST_NAME: "John Doe",
        CUST_ADDR: "123 Main St",
        CUST_ADDR2: "Suite 4",
        CUST_CITY: "Denver",
        CUST_STATE: "CO",
        CUST_ZIP: "80202",
        CELL_PHONE: "555-1234",
        EMAIL_ADDR: "john@example.com",
    };
    const nonEmpty = (val) => String(val || "").trim();
    const lines = pickCustomerAddressLines(mockOrder, nonEmpty);
    assert.deepEqual(lines, [
        "John Doe",
        "123 Main St",
        "Suite 4",
        "Denver, CO, 80202",
        "Cell: 555-1234",
        "Email: john@example.com",
    ]);
});
