var test = require('node:test');
var assert = require('node:assert/strict');
var makeDb = require('./orders-khata.fixtures');
var dates = require('../lib/dates');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');

function orderIds(db, filters) {
  return orders.list(db, filters).map(function (order) {
    return order.id;
  });
}

test('list() sorts chronologically across months and years', function () {
  assert.deepEqual(orderIds(makeDb()), [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]);
});

test('list() breaks same-date ties by descending ID across date formats', function () {
  var db = makeDb();
  db.orders[0].date = '15/03/2022';
  db.orders[7].date = '2022-03-15';

  assert.deepEqual(orderIds(db).slice(0, 2), [1008, 1001]);
});

test('list() accepts both date formats and includes both bounds', function () {
  var db = makeDb();
  db.orders[1].date = '2022-01-05';

  assert.deepEqual(orderIds(db, { from: '2022-01-01', to: '2022-01-31' }), [1004, 1003, 1002]);
  assert.deepEqual(orderIds(db, { from: '01/01/2022', to: '31/01/2022' }), [1004, 1003, 1002]);
  assert.deepEqual(orderIds(db, { from: '2022-01-05', to: '2022-01-05' }), [1002]);
});

test('list() accepts either bound on its own', function () {
  var db = makeDb();

  assert.deepEqual(orderIds(db, { from: '2022-02-18' }), [1008, 1007, 1006]);
  assert.deepEqual(orderIds(db, { to: '2022-01-05' }), [1002, 1001]);
});

test('list() combines date bounds with status and search', function () {
  var db = makeDb();

  assert.deepEqual(orderIds(db, {
    from: '2022-03-01', to: '2022-03-31', status: 'pending', search: 'suresh'
  }), [1007]);
  assert.deepEqual(orderIds(db, {
    from: '2022-01-01', to: '2022-01-31', status: 'all', search: 'meera'
  }), []);
});

test('toSortKey() accepts both date formats and rejects invalid dates', function () {
  assert.equal(dates.toSortKey('29/02/2020'), '20200229');
  assert.equal(dates.toSortKey('2022-01-05'), '20220105');
  ['', undefined, 'abc', '2022-1-05', '31/04/2022', '2022-02-29',
    '2022-00-10', '00/01/2022', '0000-01-01'].forEach(function (value) {
    assert.equal(dates.toSortKey(value), '', String(value));
  });
});

test('list() ignores invalid bounds and excludes invalid order dates from a valid range', function () {
  var db = makeDb();
  db.orders[1].date = 'invalid';

  assert.deepEqual(orderIds(db, { from: 'invalid', to: '2022-02-30' }),
    [1008, 1007, 1006, 1005, 1004, 1003, 1001, 1002]);
  assert.deepEqual(orderIds(db, { to: '2022-01-31' }), [1004, 1003, 1001]);
});

test('getFiscalYear() preserves the fiscal year in both date formats', function () {
  assert.equal(dates.getFiscalYear('05/01/2022'), 'FY21-22');
  assert.equal(dates.getFiscalYear('05/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('2022-04-05'), 'FY22-23');
});

test('recordSettlement() stores numeric totals and amounts for string and number inputs', function () {
  ['500', 500].forEach(function (amount) {
    var db = makeDb();
    var result = ledger.recordSettlement(db, 1, amount, 'upi', '');

    assert.equal(result.ok, true);
    assert.equal(result.customer.totalSettled, 1700);
    assert.equal(result.customer.balance, 732.01);
    assert.equal(result.settlement.amount, 500);
    assert.equal(result.settlement.id, 505);
    assert.equal(db.nextSettlementId, 506);
    assert.equal(db.settlements[0], result.settlement);
  });
});

test('recordSettlement() converts a legacy string totalSettled', function () {
  var db = makeDb();
  db.customers[0].totalSettled = '1200';

  var result = ledger.recordSettlement(db, 1, 500, 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
});

test('recordSettlement() treats a missing totalSettled as zero', function () {
  var db = makeDb();
  delete db.customers[0].totalSettled;

  var result = ledger.recordSettlement(db, 1, 500, 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 500);
  assert.equal(result.customer.balance, 1932.01);
});

test('recordSettlement() rejects invalid amounts without mutating the database', function () {
  var expected = {
    ok: false,
    error: 'Settlement amount must be greater than zero'
  };

  ['abc', NaN, Infinity, 0, -5].forEach(function (amount) {
    var db = makeDb();

    assert.deepEqual(ledger.recordSettlement(db, 1, amount, 'upi', ''), expected, String(amount));
    assert.deepEqual(db, makeDb());
  });
});

test('recordSettlement() rounds totalSettled and balance to paise', function () {
  var db = makeDb();
  db.customers[0].totalSettled = 0;

  assert.equal(ledger.recordSettlement(db, 1, '0.1', 'upi', '').ok, true);
  var result = ledger.recordSettlement(db, 1, '0.2', 'upi', '');

  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 0.30);
  assert.equal(result.customer.balance, 2431.71);
});
