var test = require('node:test');
var assert = require('node:assert/strict');
var inventory = require('../lib/inventory');
var orders = require('../lib/orders');
var makeDb = require('./inventory.fixtures');

test('check allows exactly the sellable quantity', function () {
  var products = makeDb().products;

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }]), { ok: true });
});

test('check rejects quantities above sellable stock and protects wholesale holds', function () {
  var products = makeDb().products;

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 2 }]), {
    ok: false,
    msg: 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)'
  });
  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 2 }]), {
    ok: false,
    msg: 'Byadgi Kashmiri Chilli Powder 500g is out of stock (1 sellable available)'
  });
});

test('check rejects duplicate lines that exceed the sellable stock of either SKU', function () {
  var products = makeDb().products;

  assert.deepEqual(inventory.check(products, [{ id: 6, qty: 1 }, { id: 6, qty: 1 }]), {
    ok: false,
    msg: 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)'
  });
  assert.deepEqual(inventory.check(products, [{ id: 11, qty: 1 }, { id: 11, qty: 1 }]), {
    ok: false,
    msg: 'Byadgi Kashmiri Chilli Powder 500g is out of stock (1 sellable available)'
  });
});

test('check accepts duplicate lines totaling three units and rejects four', function () {
  var products = [{ id: 99, name: 'Fixture product', stock: 3, reserved: 0 }];

  assert.deepEqual(inventory.check(products, [{ id: 99, qty: 1 }, { id: 99, qty: 2 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: 99, qty: 2 }, { id: 99, qty: 2 }]), {
    ok: false,
    msg: 'Fixture product is out of stock (3 sellable available)'
  });
});

test('check groups string and numeric IDs for the same product', function () {
  var products = makeDb().products;

  assert.deepEqual(inventory.check(products, [{ id: '6', qty: 1 }]), { ok: true });
  assert.deepEqual(inventory.check(products, [{ id: '6', qty: 1 }, { id: 6, qty: 1 }]), {
    ok: false,
    msg: 'A2 Gir Cow Ghee 500ml is out of stock (1 sellable available)'
  });
});

test('cancel restores physical stock once and reverses the Khata debit', function () {
  var db = makeDb();
  var ghee = inventory.find(db.products, 6);
  var oil = inventory.find(db.products, 4);
  var customer = db.customers[0];

  assert.equal(ghee.stock, 1);
  assert.equal(oil.stock, 22);
  assert.equal(customer.totalBilled, 1407);
  assert.equal(orders.cancel(db, 1007).ok, true);
  assert.equal(ghee.stock, 3);
  assert.equal(oil.stock, 24);
  assert.equal(oil.reserved, 4);
  assert.equal(customer.totalBilled, 0);

  assert.deepEqual(orders.cancel(db, 1007), {
    ok: false,
    error: 'Order #1007 is already cancelled'
  });
  assert.equal(ghee.stock, 3);
  assert.equal(oil.stock, 24);
  assert.equal(oil.reserved, 4);
  assert.equal(customer.totalBilled, 0);
});

test('cancel skips a missing product and restocks the remaining line', function () {
  var db = makeDb();
  var oil = inventory.find(db.products, 4);
  db.products = db.products.filter(function (product) {
    return product.id !== 6;
  });

  var result = orders.cancel(db, 1007);

  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'cancelled');
  assert.equal(oil.stock, 24);
  assert.equal(oil.reserved, 4);
});

test('release still frees wholesale holds without changing physical stock', function () {
  var db = makeDb();
  var oil = inventory.find(db.products, 4);

  inventory.release(db.products, [{ productId: 4, qty: 2 }]);
  assert.equal(oil.reserved, 2);
  inventory.release(db.products, [{ productId: 4, qty: 3 }]);
  assert.equal(oil.reserved, 0);
  assert.equal(oil.stock, 22);
});
