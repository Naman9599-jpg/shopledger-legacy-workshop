var test = require('node:test');
var assert = require('node:assert/strict');
var makeDb = require('./orders-khata.fixtures');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function orderIds(filters) {
  return orders.list(makeDb(), filters).map(function (order) {
    return order.id;
  });
}

test('today() returns DD/MM/YYYY', function () {
  assert.match(dates.today(), /^\d{2}\/\d{2}\/\d{4}$/);
});

test('normalizeDateKey() returns DD/MM/YYYY or an empty string', function () {
  assert.equal(dates.normalizeDateKey('2022-01-05'), '05/01/2022');
  assert.equal(dates.normalizeDateKey('05/01/2022'), '05/01/2022');
  assert.equal(dates.normalizeDateKey(''), '');
  assert.equal(dates.normalizeDateKey(undefined), '');
});

test('getFiscalYear() starts the fiscal year in April', function () {
  assert.equal(dates.getFiscalYear('05/01/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('05/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('2022-04-05'), 'FY22-23');
});

test('list() filters pending orders and includes every status for all', function () {
  assert.deepEqual(orderIds({ status: 'pending' }), [1007]);
  assert.deepEqual(orderIds({ status: 'all' }), orderIds());
});

test('list() searches by order ID, customer name, and coupon', function () {
  assert.deepEqual(orderIds({ search: '1002' }), [1002]);
  assert.deepEqual(orderIds({ search: '  mEeRa JoShI  ' }), [1006, 1001]);
  assert.deepEqual(orderIds({ search: 'save10' }), [1004, 1002]);
});

test('listCustomers() calculates Meera Joshi’s balance', function () {
  var meera = ledger.listCustomers(makeDb()).find(function (customer) {
    return customer.id === 1;
  });

  assert.equal(meera.balance, 1232.01);
});

test('recordSettlement() adds a numeric payment to totalSettled', function () {
  var result = ledger.recordSettlement(makeDb(), 1, 500, 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('recordSettlement() rejects zero, negative amounts, and NaN', function () {
  [0, -5, NaN].forEach(function (amount) {
    var db = makeDb();

    assert.deepEqual(ledger.recordSettlement(db, 1, amount, 'upi', ''), {
      ok: false,
      error: 'Settlement amount must be greater than zero'
    }, String(amount));
    assert.deepEqual(db, makeDb());
  });
});

test('recordSettlement() rejects an unknown customer', function () {
  var db = makeDb();

  assert.deepEqual(ledger.recordSettlement(db, 999, 500, 'upi', ''), {
    ok: false,
    error: 'Customer not found'
  });
  assert.deepEqual(db, makeDb());
});

test('chargeOrderToKhata() rejects a charge over the credit limit', function () {
  var db = makeDb();

  assert.deepEqual(ledger.chargeOrderToKhata(db, 1, 5000), {
    ok: false,
    error: 'Khata credit limit exceeded for Meera Joshi (Limit: ₹5000, Projected: ₹6232.01)'
  });
  assert.deepEqual(db, makeDb());
});

test('chargeOrderToKhata() updates totalBilled and balance', function () {
  var db = makeDb();
  var result = ledger.chargeOrderToKhata(db, 1, 500);

  assert.equal(result.ok, true);
  assert.equal(db.customers[0].totalBilled, 2482.01);
  assert.equal(db.customers[0].balance, 1732.01);
});

test('reverseOrderDebit() floors totalBilled at zero', function () {
  var db = makeDb();

  ledger.reverseOrderDebit(db, 1, 5000);

  assert.equal(db.customers[0].totalBilled, 0);
  assert.equal(db.customers[0].balance, -750);
});
