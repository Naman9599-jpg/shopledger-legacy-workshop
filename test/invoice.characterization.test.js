var test = require('node:test');
var assert = require('node:assert/strict');
var makeFixture = require('./fixtures');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

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
