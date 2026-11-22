var test = require('node:test');
var assert = require('node:assert/strict');
var makeFixture = require('./fixtures');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var tax = require('../lib/tax');

function paise(value) {
  return Math.round(value * 100);
}

test('Invoices reproduce billed subtotal, discount, GST, and total for all eight orders', function () {
  makeFixture().orders.forEach(function (order) {
    var figures = invoice.computeInvoiceFigures(order);
    ['subtotal', 'discount', 'tax', 'total'].forEach(function (field) {
      assert.equal(figures[field], order[field], field + ' for #' + order.id);
    });
  });
});

test('Invoice rows show HSN GST and reconcile to the discount and tax for all eight orders', function () {
  makeFixture().orders.forEach(function (order) {
    var figures = invoice.computeInvoiceFigures(order);
    var discount = 0;
    var gst = 0;
    assert.equal(figures.rows.length, order.items.length);
    assert.equal(paise(figures.taxable), paise(figures.subtotal) - paise(figures.discount));
    figures.rows.forEach(function (row, i) {
      assert.equal(row.gstPercent, tax.getSlabPercent(order.items[i]));
      assert.equal(paise(row.taxable), paise(row.line) - paise(row.discount));
      discount += paise(row.discount);
      gst += paise(row.lineTax);
    });
    assert.equal(discount, paise(figures.discount), 'discount for #' + order.id);
    assert.equal(gst, paise(figures.tax), 'GST for #' + order.id);
  });
});

test('Invoice CGST and SGST sum to GST including odd paise', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ hsn: '1006', price: 0.20, qty: 1 }], discount: 0
  });
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst], [0.01, 0.01, 0]);
  assert.equal(paise(figures.cgst) + paise(figures.sgst), paise(figures.tax));
});

test('GST reconciliation matches all eight orders', function () {
  var result = reports.getGstReconciliation(makeFixture());
  assert.equal(result.totalChecked, 8);
  assert.equal(result.mismatchCount, 0);
});

test('Historical DIWALI20 invoices retain the billed discount after expiry', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }],
    coupon: 'DIWALI20', subtotal: 1000, discount: 200, tax: 144, total: 944
  });
  assert.deepEqual([figures.subtotal, figures.discount, figures.taxable, figures.tax,
    figures.cgst, figures.sgst, figures.total], [1000, 200, 800, 144, 72, 72, 944]);
  assert.deepEqual([figures.rows[0].discount, figures.rows[0].taxable], [200, 800]);
});

test('Missing and nonfinite stored discounts use checkout coupon rules', function () {
  var order = { items: [{ hsn: '0902', price: 1000, qty: 1 }], coupon: 'SAVE10' };
  var expected = pricing.computeTotals(order.items, order.coupon);
  [undefined, NaN, Infinity].forEach(function (discount) {
    if (discount !== undefined) order.discount = discount;
    var figures = invoice.computeInvoiceFigures(order);
    ['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total'].forEach(function (field) {
      assert.equal(figures[field], expected[field], field);
    });
  });
});

test('Empty items, missing HSN, unknown coupons, and recorded zero discounts work', function () {
  var empty = invoice.computeInvoiceFigures({ items: [], coupon: 'SAVE10' });
  assert.deepEqual([empty.total, empty.tax, empty.rows], [0, 0, []]);
  var items = [{ price: 600, qty: 1 }];
  var unknown = invoice.computeInvoiceFigures({ items: items, coupon: 'UNKNOWN' });
  assert.deepEqual([unknown.rows[0].gstPercent, unknown.discount, unknown.tax, unknown.total],
    [18, 0, 108, 708]);
  var zero = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10', discount: 0 });
  assert.deepEqual([zero.discount, zero.tax, zero.total], [0, 108, 708]);
});

test('Printed invoice escapes text and aligns #1002 row cells with the ordered headers and totals', function () {
  var order = makeFixture().orders.find(function (item) { return item.id === 1002; });
  order.customer = '<Customer & Co>';
  order.items[0].name = '<Rice & Co>';
  var html = invoice.render(order);
  var headings = html.match(/<thead><tr>(.*?)<\/tr><\/thead>/)[1];
  var row = html.match(/<tbody><tr>(.*?)<\/tr>/)[1];
  var totals = html.match(/<table class="totals-table">(.*?)<\/table>/)[1];
  var labels = Array.from(totals.matchAll(/<tr[^>]*><td>(.*?)<\/td>/g), function (match) {
    return match[1];
  });

  assert.ok(html.includes('Billed To:</strong><br>&lt;Customer &amp; Co&gt;'));
  assert.ok(html.includes('window.print()'));
  assert.deepEqual(Array.from(headings.matchAll(/<th[^>]*>(.*?)<\/th>/g), function (match) {
    return match[1];
  }), ['#', 'Item Description', 'HSN', 'Qty', 'Rate', 'Line Gross', 'Disc.', 'Taxable', 'GST %', 'GST Amt']);
  assert.deepEqual(Array.from(row.matchAll(/<td[^>]*>(.*?)<\/td>/g), function (match) {
    return match[1].replace(/<[^>]*>/g, '');
  }), ['1', '&lt;Rice &amp; Co&gt;SKU: GRN-001', '1006', '1',
    '₹640.00', '₹640.00', '₹64.00', '₹576.00', '5%', '₹28.80']);
  assert.deepEqual(labels, ['Gross Subtotal', 'Coupon Discount (SAVE10)', 'Taxable Value',
    'CGST', 'SGST', 'Invoice Total']);
});
