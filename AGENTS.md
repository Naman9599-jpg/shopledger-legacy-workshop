# Repository Guidelines

## Stack

Use Node.js 22+ for development. The app uses Express 4, body-parser, CommonJS,
and ES5-style JavaScript. Follow the existing style with `var`, callbacks,
semicolons, and two-space indentation. The static UI uses vanilla JavaScript.
`lib/store.js` reads and writes a single JSON file. There is no database server,
build step, or installed test framework. Use Node's built-in test runner.

## Module map

- `server.js` serves the static UI, mounts the API, and serves printable invoices.
- `config.js` holds the port, shop details, GST slabs, coupons, inventory defaults, and admin export key.
- `routes/products.js` exposes the product catalog, sellable stock, and active coupons.
- `routes/orders.js` handles order creation, lookup, listing, and cancellation.
- `routes/customers.js` lists customer accounts and records Khata settlements.
- `routes/reports.js` exposes dashboard figures, GST reconciliation, cart preview, and admin export.
- `lib/store.js` reads and writes the JSON store and appends audit entries.
- `lib/orders.js` creates, finds, filters, sorts, and cancels orders.
- `lib/inventory.js` checks and deducts stock, releases wholesale holds, and summarizes inventory.
- `lib/pricing.js` calculates subtotals, apportions discounts, and applies per-line GST.
- `lib/tax.js` resolves GST rates and splits CGST and SGST.
- `lib/coupons.js` normalizes, validates, and calculates coupon discounts.
- `lib/ledger.js` tracks Khata balances, credit checks, debits, reversals, and settlements.
- `lib/invoice.js` calculates invoice figures and renders printable HTML.
- `lib/reports.js` aggregates dashboard figures and compares invoice amounts with saved order amounts.
- `lib/dates.js` formats dates, normalizes filter input, and derives fiscal-year labels.
- `public/index.html` defines the POS, Order History, Customer Khata, and Inventory & GST Audit views.
- `public/js/app.js` handles browser state, API requests, and rendering.
- `public/css/style.css` styles the dashboard, forms, and tables.
- `data/db.json` holds products, orders, customers, settlements, audit entries, and ID counters.
- `docs/architecture.svg` maps module dependencies and the checkout and invoice flows.

## Commands

- Install with `npm install`. It creates `package-lock.json`, which stays local.
- Run with `npm start` (runs `node server.js`). Open http://localhost:3000. Set `PORT` to override the default.
- Run tests with `node --test` once tests exist. `npm test` currently runs a placeholder that exits with status 1.
- Reset data after manual testing with `git checkout data/db.json`. This discards unstaged changes to that file.

## Rules for agents

1. Write characterization tests with `node:test` and `node:assert/strict` before changing behaviour. Name tests that pin bugs `CURRENT BEHAVIOUR: ...`.
2. Limit each fix branch to the ticket's `lib/` modules, its `test/` files, and the `package.json` test script if needed. Keep unrelated refactors and reformatting out of the fix. Land `AGENTS.md` and `docs/` separately on `main`.
3. Use deep-cloned in-memory fixtures per test. Tests never read or write `data/db.json`. After each test run, run `git diff --exit-code data/db.json`.
4. Add no entries to `dependencies` or `devDependencies`.
5. Reproduce bugs in the running app only on a temporary project copy using a port other than 3000. Use the copy's data file.
6. Stage by explicit path. Never commit `package-lock.json`, `node_modules/`, or temporary files.
