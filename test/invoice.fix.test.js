var test = require('node:test');
var assert = require('node:assert/strict');
var hash = require('node:crypto').hash;
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

function flat50Order() {
  var items = [140, 190, 260].map(function (price) {
    return { hsn: '1006', price: price, qty: 1 };
  });
  var billed = pricing.computeTotals(items, 'FLAT50');
  assert.equal(billed.discount, 50);
  return { items: items, coupon: 'FLAT50', discount: billed.discount };
}

test('FLAT50 printed row discounts and taxable values reconcile in paise', function () {
  var figures = invoice.computeInvoiceFigures(flat50Order());
  var discount = 0;
  var taxable = 0;
  figures.rows.forEach(function (row) {
    assert.equal(paise(row.taxable), paise(row.line) - paise(row.discount));
    discount += paise(row.discount);
    taxable += paise(row.taxable);
  });
  assert.deepEqual([discount, taxable], [paise(figures.discount), paise(figures.taxable)]);
  assert.deepEqual(figures.rows.map(function (row) { return row.discount; }), [11.86, 16.10, 22.04]);
});

test('FLAT50 invoice totals and per-line GST match checkout', function () {
  var order = flat50Order();
  var billed = pricing.computeTotals(order.items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);
  ['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total'].forEach(function (field) {
    assert.equal(figures[field], billed[field], field);
  });
  var gst = 0;
  figures.rows.forEach(function (row, i) {
    assert.equal(row.lineTax, billed.lines[i].tax);
    gst += paise(row.lineTax);
  });
  assert.equal(gst, paise(figures.tax));
});

test('All eight seed invoices preserve their serialized totals and rows when there is no remainder', function () {
  // SHA-256 of each complete invoice figure object before the display adjustment.
  var expected = {
    1001: '84f5c23cc83dc9679c653a8dd0319119e7506aedb1f9312315f4ad49d0472d7d',
    1002: '0baed174add81e32112d63fa818ac2f2a68831b06b156d4350ab26063b32b967',
    1003: '52bb55c5dbe7d41de5d0ea8f94cf0f30ca9b73c951e74e7eade8f11da936a3ba',
    1004: 'e17ac033f35bcd16e8be2ba11f212ec271652b84e5c8a12f0b120e81ff326a23',
    1005: '7861b7fa29025c4339c81640d3c551332e0295c69f37580c4dcbc8b5185c39bd',
    1006: 'fbc6c1eca414911b687dd8e21ebb0bcbf40c851edbd5c413eaba2f407fd1dad6',
    1007: 'c8ca6db144c1075edd8e4dcef0092909565d059a6ca4ccadb0dfb1cd94edd31a',
    1008: '0c790107d8d8c423d5116853dd363b97eca89ddacc642c950393f9fc29f2f0b4'
  };
  var orders = makeFixture().orders;
  assert.equal(orders.length, Object.keys(expected).length);
  orders.forEach(function (order) {
    var figures = invoice.computeInvoiceFigures(order);
    var billed = pricing.computeTotalsWithDiscount(order.items, order.discount);
    var billedRows = billed.lines.map(function (line) {
      return [line.discount, line.taxable];
    });
    assert.equal(billedRows.reduce(function (sum, row) { return sum + paise(row[0]); }, 0),
      paise(billed.discount), 'zero remainder for #' + order.id);
    assert.deepEqual(figures.rows.map(function (row) { return [row.discount, row.taxable]; }),
      billedRows, 'unchanged row amounts for #' + order.id);
    assert.equal(hash('sha256', JSON.stringify(figures)), expected[order.id], 'invoice #' + order.id);
  });
});

test('A negative rounding remainder goes to the first of the tied largest rows', function () {
  var figures = invoice.computeInvoiceFigures({
    items: [{ price: 10, qty: 1 }, { price: 10, qty: 1 }],
    discount: 0.01
  });
  assert.deepEqual(figures.rows.map(function (row) { return [row.discount, row.taxable]; }),
    [[0, 10], [0.01, 9.99]]);
});

[
  { discount: 0.02, remainder: 2, discounts: [1, 1, 0, 0, 0] },
  { discount: 0.03, remainder: -2, discounts: [0, 0, 1, 1, 1] }
].forEach(function (scenario) {
  test('Five one-paisa lines absorb a ' + scenario.remainder + ' paise remainder within bounds', function () {
    var items = [1, 2, 3, 4, 5].map(function (id) {
      return { id: id, name: 'Item ' + id, hsn: '1006', price: 0.01, qty: 1 };
    });
    var billed = pricing.computeTotalsWithDiscount(items, scenario.discount);
    var billedDiscount = billed.lines.reduce(function (sum, line) {
      return sum + paise(line.discount);
    }, 0);
    assert.equal(paise(billed.discount) - billedDiscount, scenario.remainder);

    var figures = invoice.computeInvoiceFigures({ items: items, discount: scenario.discount });
    var discount = 0;
    var taxable = 0;
    figures.rows.forEach(function (row, i) {
      var rowDiscount = paise(row.discount);
      assert.ok(rowDiscount >= 0 && rowDiscount <= paise(row.line), 'discount bounds on row ' + i);
      assert.equal(paise(row.taxable), paise(row.line) - rowDiscount);
      assert.equal(row.lineTax, billed.lines[i].tax);
      assert.equal(row.name, items[i].name);
      discount += rowDiscount;
      taxable += paise(row.taxable);
    });
    assert.equal(discount, paise(figures.discount));
    assert.equal(taxable, paise(figures.taxable));
    assert.deepEqual(figures.rows.map(function (row) { return paise(row.discount); }), scenario.discounts);
  });
});

test('Invoice figures are unchanged for a single line, empty items, and a zero discount', function () {
  [
    { items: [{ hsn: '1006', price: 10, qty: 1 }], discount: 0.03 },
    { items: [], discount: 0.03 },
    { items: [{ price: 1, qty: 1 }, { price: 2, qty: 1 }], discount: 0 }
  ].forEach(function (order) {
    var billed = pricing.computeTotalsWithDiscount(order.items, order.discount);
    var figures = invoice.computeInvoiceFigures(order);
    ['subtotal', 'discount', 'taxable', 'tax', 'cgst', 'sgst', 'total'].forEach(function (field) {
      assert.equal(figures[field], billed[field], field);
    });
    assert.deepEqual(figures.rows.map(function (row) {
      return [row.line, row.discount, row.taxable, row.lineTax];
    }), billed.lines.map(function (line) {
      return [line.gross, line.discount, line.taxable, line.tax];
    }));
  });
});
