var test = require('node:test');
var assert = require('node:assert/strict');
var makeFixture = require('./fixtures');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function findOrder(db, id) {
  return db.orders.find(function (order) { return order.id === id; });
}

test('Invoice #1008 matches the stored ledger', function () {
  var order = findOrder(makeFixture(), 1008);
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.total, 590);
  assert.equal(figures.tax, 90);
  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
});

test('Checkout reproduces the stored total and GST for all eight orders', function () {
  makeFixture().orders.forEach(function (order) {
    var totals = pricing.computeTotals(order.items, order.coupon);
    assert.equal(totals.total, order.total, 'total for #' + order.id);
    assert.equal(totals.tax, order.tax, 'GST for #' + order.id);
  });
});

test('Invoice CGST and SGST sum to GST in paise for all eight orders', function () {
  makeFixture().orders.forEach(function (order) {
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(Math.round(figures.cgst * 100) + Math.round(figures.sgst * 100),
      Math.round(figures.tax * 100), 'GST split for #' + order.id);
  });
});

test('CURRENT BEHAVIOUR: invoice taxes #1002 at 18% and discounts after tax without cap', function () {
  var figures = invoice.computeInvoiceFigures(findOrder(makeFixture(), 1002));
  assert.equal(figures.total, 1083.24);
  assert.equal(figures.tax, 183.60);
  assert.equal(figures.discount, 120.36);
});

test('CURRENT BEHAVIOUR: invoice discount for #1004 exceeds the ₹150 cap', function () {
  var order = findOrder(makeFixture(), 1004);
  assert.equal(order.discount, 150);
  assert.equal(invoice.computeInvoiceFigures(order).discount, 264.32);
});

test('CURRENT BEHAVIOUR: every line of #1001 and #1007 shows 18% GST', function () {
  var db = makeFixture();
  [1001, 1007].forEach(function (id) {
    var rows = invoice.computeInvoiceFigures(findOrder(db, id)).rows;
    assert.deepEqual(rows.map(function (row) { return row.gstPercent; }), [18, 18], '#' + id);
  });
});

test('CURRENT BEHAVIOUR: invoice totals and GST for all eight orders', function () {
  var db = makeFixture();
  var cases = [
    { id: 1001, total: 719.80, tax: 109.80 },
    { id: 1002, total: 1083.24, tax: 183.60 },
    { id: 1003, total: 422, tax: 72 },
    { id: 1004, total: 2378.88, tax: 403.20 },
    { id: 1005, total: 1130, tax: 180 },
    { id: 1006, total: 1356.41, tax: 217.80 },
    { id: 1007, total: 1510.40, tax: 230.40 },
    { id: 1008, total: 590, tax: 90 }
  ];
  cases.forEach(function (expected) {
    var figures = invoice.computeInvoiceFigures(findOrder(db, expected.id));
    assert.equal(figures.total, expected.total, 'total for #' + expected.id);
    assert.equal(figures.tax, expected.tax, 'GST for #' + expected.id);
  });
});

test('CURRENT BEHAVIOUR: GST reconciliation flags 7 of 8 orders', function () {
  var result = reports.getGstReconciliation(makeFixture());
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 7);
});

test('CURRENT BEHAVIOUR: historical DIWALI20 invoice shows ₹236 discount and ₹180 GST at ₹944 total', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', price: 1000, qty: 1, hsn: '0902' }],
    coupon: 'DIWALI20',
    subtotal: 1000,
    discount: 200,
    tax: 144,
    total: 944
  });
  assert.equal(figures.subtotal, 1000);
  assert.equal(figures.discount, 236);
  assert.equal(figures.tax, 180);
  assert.equal(figures.cgst, 90);
  assert.equal(figures.sgst, 90);
  assert.equal(figures.total, 944);
});
