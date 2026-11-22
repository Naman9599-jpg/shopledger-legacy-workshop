var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var tax = require('../lib/tax');

function mixedItems(ricePrice, otherName, otherHsn) {
  return [
    { id: 1, name: 'Rice', hsn: '1006', price: ricePrice, qty: 1 },
    { id: 2, name: otherName, hsn: otherHsn, price: 200, qty: 1 }
  ];
}

test('computeTotals apportions SAVE10 before applying 5% and 12% GST', function () {
  assert.deepEqual(pricing.computeTotals(mixedItems(400, 'Ghee', '0405'), 'SAVE10'), {
    subtotal: 600, discount: 60, taxable: 540, tax: 39.60, cgst: 19.80, sgst: 19.80, total: 579.60,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 400, discount: 40, taxable: 360, tax: 18, net: 378 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 200, discount: 20, taxable: 180, tax: 21.60, net: 201.60 }
    ]
  });
});

test('computeTotals applies 5% and 18% GST to gross lines without a coupon', function () {
  assert.deepEqual(pricing.computeTotals(mixedItems(300, 'Tea', '0902')), {
    subtotal: 500, discount: 0, taxable: 500, tax: 51, cgst: 25.50, sgst: 25.50, total: 551,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 300, discount: 0, taxable: 300, tax: 15, net: 315 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 200, discount: 0, taxable: 200, tax: 36, net: 236 }
    ]
  });
});

test('computeTotals apportions FLAT50 before applying 5% and 18% GST', function () {
  assert.deepEqual(pricing.computeTotals(mixedItems(300, 'Tea', '0902'), 'FLAT50'), {
    subtotal: 500, discount: 50, taxable: 450, tax: 45.90, cgst: 22.95, sgst: 22.95, total: 495.90,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 300, discount: 30, taxable: 270, tax: 13.50, net: 283.50 },
      { id: 2, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 200, discount: 20, taxable: 180, tax: 32.40, net: 212.40 }
    ]
  });
});

test('calculateDiscount applies percentage and flat coupons', function () {
  assert.equal(coupons.calculateDiscount(600, 'SAVE10'), 60);
  assert.equal(coupons.calculateDiscount(300, 'FLAT50'), 50);
});

test('calculateDiscount enforces the percentage cap and minimum subtotal', function () {
  assert.equal(coupons.calculateDiscount(2240, 'SAVE10'), 150);
  assert.equal(coupons.calculateDiscount(499, 'SAVE10'), 0);
});

test('calculateDiscount returns zero for unknown and inactive codes and accepts lowercase', function () {
  assert.equal(coupons.calculateDiscount(600, 'UNKNOWN'), 0);
  assert.equal(coupons.calculateDiscount(1000, 'DIWALI20'), 0);
  assert.equal(coupons.calculateDiscount(600, 'save10'), 60);
});

test('calculateDiscount bounds an eligible flat coupon by the subtotal', function (t) {
  // Use a flat offer with no minimum so a subtotal below its value is eligible.
  t.mock.method(coupons, 'getCoupon', function () {
    return { type: 'flat', value: 50, minOrder: 0 };
  });
  assert.equal(coupons.calculateDiscount(25, 'TESTFLAT'), 25);
});

test('validate returns the exact errors for invalid, expired, and below-minimum coupons', function () {
  assert.deepEqual(coupons.validate('unknown', 500), {
    valid: false, error: 'Invalid coupon code: UNKNOWN'
  });
  assert.deepEqual(coupons.validate('DIWALI20', 1000), {
    valid: false, error: 'Coupon DIWALI20 has expired'
  });
  assert.deepEqual(coupons.validate('SAVE10', 499), {
    valid: false, error: 'Coupon SAVE10 requires a minimum order subtotal of ₹500'
  });
});

test('validate returns the full eligible SAVE10 result on ₹600', function () {
  assert.deepEqual(coupons.validate('SAVE10', 600), {
    valid: true,
    code: 'SAVE10',
    discount: 60,
    coupon: {
      type: 'percent',
      value: 10,
      minOrder: 500,
      maxDiscount: 150,
      active: true,
      description: '10% off on orders above ₹500 (max ₹150)'
    }
  });
});

test('getRateForItem resolves the 5%, 12%, and 18% HSN slabs', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006' }), 0.05);
  assert.equal(tax.getRateForItem({ hsn: '0405' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '0902' }), 0.18);
});

test('getRateForItem defaults unknown HSN, missing HSN, and null to 18%', function () {
  assert.equal(tax.getRateForItem({ hsn: '9999' }), 0.18);
  assert.equal(tax.getRateForItem({}), 0.18);
  assert.equal(tax.getRateForItem(null), 0.18);
});

test('getRateForItem accepts numeric percentage and decimal overrides', function () {
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 12 }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '1006', gstRate: 0.12 }), 0.12);
});

test('splitCgstSgst assigns the odd paise to CGST and preserves the exact sum', function () {
  var split = tax.splitCgstSgst(45.91);
  assert.deepEqual(split, { cgst: 22.96, sgst: 22.95 });
  assert.equal(Math.round(split.cgst * 100) + Math.round(split.sgst * 100), 4591);
});
