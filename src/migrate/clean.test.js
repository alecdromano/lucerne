const test = require("node:test");
const assert = require("node:assert/strict");

const {
    cleanName,
    formatPhone,
    cleanEmail,
    cleanZip,
    truthyTaxExempt,
    titleCase,
} = require("./clean.js");

test("cleanName splits and sanitizes names in LAST FIRST order", () => {
    assert.deepEqual(cleanName("SMITH JOHN"), ["John", "Smith"]);
    assert.deepEqual(cleanName("DOE JANE"), ["Jane", "Doe"]);
    assert.deepEqual(cleanName("O'CONNOR TIM"), ["Tim", "O'connor"]);
});

test("cleanName collapses test/unidentified/numeric entries", () => {
    assert.deepEqual(cleanName("WALK IN"), ["Unidentified", "Unidentified"]);
    assert.deepEqual(cleanName("CASH SALE"), ["Unidentified", "Unidentified"]);
    assert.deepEqual(cleanName("TEST CUSTOMER"), ["Unidentified", "Unidentified"]);
    assert.deepEqual(cleanName("JOHN 123"), ["Unidentified", "Unidentified"]);
    assert.deepEqual(cleanName(""), ["Unidentified", "Unidentified"]);
});

test("formatPhone standardizes 10-digit US phone numbers with E.164 +1 prefix", () => {
    assert.equal(formatPhone("(555) 123-4567"), "+15551234567");
    assert.equal(formatPhone("1-555-123-4567"), "+15551234567");
    assert.equal(formatPhone("5551234567"), "+15551234567");
    assert.equal(formatPhone("12345"), "");
    assert.equal(formatPhone(""), "");
});

test("cleanEmail standardizes lowercase valid emails and rejects malformed strings", () => {
    assert.equal(cleanEmail("User@Example.COM"), "user@example.com");
    assert.equal(cleanEmail("invalid-email"), "");
    assert.equal(cleanEmail(""), "");
});

test("cleanZip formats 5-digit and 9-digit zip codes", () => {
    assert.equal(cleanZip("90210"), "90210");
    assert.equal(cleanZip("902101234"), "90210-1234");
    assert.equal(cleanZip("9021"), "");
});

test("truthyTaxExempt normalizes boolean-like values", () => {
    assert.equal(truthyTaxExempt("Y"), "TRUE");
    assert.equal(truthyTaxExempt("yes"), "TRUE");
    assert.equal(truthyTaxExempt("1"), "TRUE");
    assert.equal(truthyTaxExempt("true"), "TRUE");
    assert.equal(truthyTaxExempt("N"), "FALSE");
    assert.equal(truthyTaxExempt("0"), "FALSE");
    assert.equal(truthyTaxExempt(""), "");
});

test("titleCase capitalizes words properly", () => {
    assert.equal(titleCase("acme auto repair"), "Acme Auto Repair");
    assert.equal(titleCase("CHEVROLET"), "Chevrolet");
});
