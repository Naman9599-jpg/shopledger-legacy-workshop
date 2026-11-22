var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var makeDb = require('./inventory.fixtures');

test('getSellableStock subtracts wholesale holds from physical stock', function () {
  var products = makeDb().products;

  assert.equal(inventory.getSellableStock(inventory.find(products, 6)), 1);
  assert.equal(inventory.getSellableStock(inventory.find(products, 11)), 1);
  assert.equal(inventory.getSellableStock(inventory.find(products, 4)), 18);
  assert.equal(inventory.getSellableStock(inventory.find(products, 10)), 0);
});

test('check accepts a quantity below sellable stock', function () {
  var db = makeDb();

  assert.deepEqual(inventory.check(db.products, [{ id: 4, qty: 17 }]), { ok: true });
});

test('check rejects an unknown product id', function () {
  var db = makeDb();

  assert.deepEqual(inventory.check(db.products, [{ id: 999, qty: 1 }]), {
    ok: false,
    msg: 'Unknown product 999'
  });
});

test('reserve deducts physical stock and preserves wholesale holds', function () {
  var db = makeDb();
  var oil = inventory.find(db.products, 4);

  inventory.reserve(db.products, [{ id: 4, qty: 2 }]);

  assert.equal(oil.stock, 20);
  assert.equal(oil.reserved, 4);
});

test('release looks up productId and decrements reserved to a minimum of zero', function () {
  var db = makeDb();
  var oil = inventory.find(db.products, 4);

  inventory.release(db.products, [{ productId: 4, qty: 2 }]);
  assert.equal(oil.reserved, 2);
  assert.equal(oil.stock, 22);

  inventory.release(db.products, [{ productId: 4, qty: 3 }]);
  assert.equal(oil.reserved, 0);
  assert.equal(oil.stock, 22);
});

test('summarize counts stock levels and values physical stock', function () {
  var db = makeDb();

  assert.deepEqual(inventory.summarize(db.products), {
    totalSkus: 12,
    outOfStockCount: 1,
    lowStockCount: 3,
    totalValuation: 52700
  });
});

test('cancel records the status and reason and reverses the Khata debit', function () {
  var db = makeDb();
  var order = db.orders[0];
  var customer = db.customers[0];
  var reason = 'Customer requested cancellation';

  assert.equal(order.status, 'pending');
  assert.equal(customer.totalBilled, 1407);

  var result = orders.cancel(db, 1007, reason);

  assert.equal(result.ok, true);
  assert.equal(result.order, order);
  assert.equal(order.status, 'cancelled');
  assert.equal(order.cancelReason, reason);
  assert.equal(customer.totalBilled, 0);
});

test('cancel rejects an already cancelled order', function () {
  var db = makeDb();

  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.deepEqual(orders.cancel(db, 1007), {
    ok: false,
    error: 'Order #1007 is already cancelled'
  });
});

test('cancel rejects an unknown order id', function () {
  var db = makeDb();

  assert.deepEqual(orders.cancel(db, 999), {
    ok: false,
    error: 'Order not found'
  });
});
