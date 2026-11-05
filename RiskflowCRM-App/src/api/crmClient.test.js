import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';

// jsdom does not implement Web Crypto subtle, and crmClient needs it for PBKDF2 password hashes.
// Stub the Node implementation onto the global crypto object when it is missing.
beforeAll(() => {
  const cryptoTarget = globalThis.crypto ?? window.crypto;
  if (cryptoTarget && !cryptoTarget.subtle) {
    Object.defineProperty(cryptoTarget, 'subtle', { value: webcrypto.subtle, configurable: true });
  }
  if (cryptoTarget && !cryptoTarget.randomUUID) {
    Object.defineProperty(cryptoTarget, 'randomUUID', { value: webcrypto.randomUUID.bind(webcrypto), configurable: true });
  }
});

// crmClient keeps module-level state (corrupt-entity markers, verified raw values, the
// in-flight migration promise), so every test gets a fresh module instance and fresh storage.
let api;
let crmClient;

const PROFILE_KEY = 'riskflow_crm:business_profile:v1';
const rawStored = (name) => window.localStorage.getItem(`riskflow_crm:${name}`);

const seedProfile = (overrides = {}) =>
  api.writeBusinessProfile({
    ...api.defaultBusinessProfile,
    companyName: 'Test Co',
    taxRate: 0,
    encryptionKey: 'unit-test-encryption-key',
    ...overrides,
  });

const makeProduct = (overrides = {}) =>
  crmClient.products.create({
    name: 'Widget',
    sku: `W-${Math.random().toString(36).slice(2, 10)}`,
    unit_price: 10,
    cost_price: 4,
    stock_quantity: 10,
    reorder_level: 1,
    ...overrides,
  });

const stockOf = async (productId) =>
  (await crmClient.products.list()).find((product) => product.id === productId).stock_quantity;

beforeEach(async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.resetModules();
  api = await import('./crmClient.js');
  crmClient = api.crmClient;
  seedProfile();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('money rounding on quotes, sales orders, sales and payments', () => {
  it('rounds a 0.1 + 0.2 subtotal and derives tax and total from the rounded values', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'Rounding', subtotal: 0.1 + 0.2, tax_rate: 10 });
    expect(quote.subtotal).toBe(0.3);
    expect(quote.tax_amount).toBe(0.03);
    expect(quote.total_amount).toBe(0.33);
  });

  it('rounds half-cent subtotals (1.005 -> 1.01) on quotes', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'Half cent', subtotal: 1.005, tax_rate: 0 });
    expect(quote.subtotal).toBe(1.01);
    expect(quote.total_amount).toBe(1.01);
  });

  it('applies a fractional tax rate and rounds the tax line to cents on sales orders', async () => {
    // 19.99 * 8.25% = 1.649175 -> 1.65; total = 19.99 + 1.65 = 21.64
    const order = await crmClient.salesOrders.create({ customer_name: 'Tax', subtotal: 19.99, tax_rate: 8.25 });
    expect(order.tax_amount).toBe(1.65);
    expect(order.total_amount).toBe(21.64);
  });

  it('subtracts a discount after tax and keeps cents exact', async () => {
    const order = await crmClient.salesOrders.create({
      customer_name: 'Discount',
      subtotal: 100,
      tax_rate: 10,
      discount_amount: 15.5,
    });
    expect(order.total_amount).toBe(94.5);
  });

  it('parses numeric strings in money fields', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'Strings', subtotal: '10.10', tax_rate: 0 });
    expect(quote.subtotal).toBe(10.1);
    expect(quote.total_amount).toBe(10.1);
  });

  it('rounds the sale unit price and total', async () => {
    const product = await makeProduct({ unit_price: 1.005, stock_quantity: 10 });
    expect(product.unit_price).toBe(1.01);
    const sale = await crmClient.sales.create({ product_id: product.id, quantity: 3 });
    expect(sale.unit_price).toBe(1.01);
    expect(sale.total_amount).toBe(3.03);
  });

  it('rounds purchase order totals built from 0.1 style unit costs', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Cents Supply' });
    const product = await makeProduct();
    const order = await crmClient.purchases.create({
      supplier_id: supplier.id,
      product_id: product.id,
      quantity: 3,
      unit_cost: 0.1,
      status: 'ordered',
    });
    expect(order.total_amount).toBe(0.3);
  });

  it('sums payments that individually carry float noise and marks the order paid at exactly the total', async () => {
    const order = await crmClient.salesOrders.create({ customer_name: 'Split', subtotal: 0.3, tax_rate: 0, status: 'confirmed' });
    await crmClient.payments.create({ reference_type: 'sales_order', reference_id: order.id, amount: 0.1 });
    await crmClient.payments.create({ reference_type: 'sales_order', reference_id: order.id, amount: 0.2 });
    const updated = (await crmClient.salesOrders.list()).find((item) => item.id === order.id);
    expect(updated.collected_amount).toBe(0.3);
    expect(updated.balance_due).toBe(0);
    expect(updated.payment_status).toBe('paid');
  });
});

describe('document numbering', () => {
  it('issues sequential quote numbers starting at QT-0001', async () => {
    const first = await crmClient.quotes.create({ customer_name: 'A', subtotal: 1 });
    const second = await crmClient.quotes.create({ customer_name: 'B', subtotal: 1 });
    expect(first.document_number).toBe('QT-0001');
    expect(second.document_number).toBe('QT-0002');
    expect(rawStored('doc_counter:Quote')).toBe('2');
  });

  it('never reuses a number after the record that held it is deleted', async () => {
    const first = await crmClient.quotes.create({ customer_name: 'A', subtotal: 1 });
    const second = await crmClient.quotes.create({ customer_name: 'B', subtotal: 1 });
    await crmClient.quotes.delete(second.id);
    const third = await crmClient.quotes.create({ customer_name: 'C', subtotal: 1 });
    expect(first.document_number).toBe('QT-0001');
    expect(third.document_number).toBe('QT-0003');
  });

  it('keeps separate sequences per entity (quotes vs sales orders)', async () => {
    await crmClient.quotes.create({ customer_name: 'A', subtotal: 1 });
    await crmClient.quotes.create({ customer_name: 'B', subtotal: 1 });
    const order = await crmClient.salesOrders.create({ customer_name: 'O', subtotal: 1 });
    expect(order.document_number).toBe('SO-0001');
  });

  it('ignores malformed or foreign-prefix numbers when computing the next value', async () => {
    await crmClient.entities.Quote.create({ customer_name: 'bad1', document_number: 'XQT-0999' });
    await crmClient.entities.Quote.create({ customer_name: 'bad2', document_number: 'QT-12abc' });
    await crmClient.entities.Quote.create({ customer_name: 'bad3', document_number: 'QT-' });
    const quote = await crmClient.quotes.create({ customer_name: 'D', subtotal: 1 });
    expect(quote.document_number).toBe('QT-0001');
  });

  it('continues after the highest well-formed number already stored (e.g. after an import)', async () => {
    await crmClient.entities.Quote.create({ customer_name: 'legacy', document_number: 'QT-0007' });
    const quote = await crmClient.quotes.create({ customer_name: 'next', subtotal: 1 });
    expect(quote.document_number).toBe('QT-0008');
  });
});

describe('approvals', () => {
  it('creates a quote approval request that points at the quote real id', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'Big client', subtotal: 30000 });
    expect(quote.approval_status).toBe('pending');
    const requests = await crmClient.approvals.list();
    const request = requests.find((item) => item.entity_type === 'Quote' && item.entity_id === quote.id);
    expect(request).toBeDefined();
    expect(request.status).toBe('pending');
    expect(request.amount).toBe(30000);
  });

  it('creates a purchase approval request that points at the purchase order real id', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct();
    const order = await crmClient.purchases.create({
      supplier_id: supplier.id,
      product_id: product.id,
      quantity: 1000,
      unit_cost: 20, // 20000 > 15000 threshold
      status: 'ordered',
    });
    expect(order.approval_status).toBe('pending');
    const requests = await crmClient.approvals.list();
    expect(requests.some((item) => item.entity_type === 'PurchaseOrder' && item.entity_id === order.id)).toBe(true);
  });

  it('creates an expense approval request only above the threshold and treats the threshold itself as approved', async () => {
    const big = await crmClient.expenses.create({ title: 'Big trip', amount: 9000 });
    const edge = await crmClient.expenses.create({ title: 'Exactly threshold', amount: 5000 });
    const small = await crmClient.expenses.create({ title: 'Coffee', amount: 4 });
    expect(big.approval_status).toBe('pending');
    expect(edge.approval_status).toBe('approved');
    expect(small.approval_status).toBe('approved');
    const requests = await crmClient.approvals.list();
    expect(requests.some((item) => item.entity_type === 'Expense' && item.entity_id === big.id)).toBe(true);
    expect(requests.some((item) => item.entity_id === edge.id || item.entity_id === small.id)).toBe(false);
  });

  it('does not add stock for a purchase order that is received while its approval is pending, and applies it once on approval', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct({ stock_quantity: 10 });
    const order = await crmClient.purchases.create({
      supplier_id: supplier.id,
      product_id: product.id,
      quantity: 1000,
      unit_cost: 20,
      status: 'received',
    });
    expect(order.approval_status).toBe('pending');
    expect(order.stock_applied).toBe(false);
    expect(await stockOf(product.id)).toBe(10);

    const request = (await crmClient.approvals.list()).find((item) => item.entity_id === order.id);
    await crmClient.approvals.decide(request.id, 'approved', 'ok');
    expect(await stockOf(product.id)).toBe(1010);

    // A repeated approval must not add the quantity a second time.
    await crmClient.approvals.decide(request.id, 'approved', 'again');
    expect(await stockOf(product.id)).toBe(1010);

    const stored = (await crmClient.purchases.list()).find((item) => item.id === order.id);
    expect(stored.approval_status).toBe('approved');
    expect(stored.stock_applied).toBe(true);
  });

  it('leaves stock unchanged when the purchase order is rejected', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct({ stock_quantity: 10 });
    const order = await crmClient.purchases.create({
      supplier_id: supplier.id,
      product_id: product.id,
      quantity: 1000,
      unit_cost: 20,
      status: 'received',
    });
    const request = (await crmClient.approvals.list()).find((item) => item.entity_id === order.id);
    await crmClient.approvals.decide(request.id, 'rejected', 'no');
    expect(await stockOf(product.id)).toBe(10);
    const stored = (await crmClient.purchases.list()).find((item) => item.id === order.id);
    expect(stored.approval_status).toBe('rejected');
    expect(stored.stock_applied).toBe(false);
  });

  it('applies stock when an ordered (not yet received) purchase is approved and then received', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct({ stock_quantity: 10 });
    const order = await crmClient.purchases.create({
      supplier_id: supplier.id,
      product_id: product.id,
      quantity: 1000,
      unit_cost: 20,
      status: 'ordered',
    });
    const request = (await crmClient.approvals.list()).find((item) => item.entity_id === order.id);
    await crmClient.approvals.decide(request.id, 'approved', '');
    expect(await stockOf(product.id)).toBe(10);
    await crmClient.purchases.update(order.id, { status: 'received' });
    expect(await stockOf(product.id)).toBe(1010);
  });

  it('reverses applied stock when an approved, received purchase order is later rejected', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct({ stock_quantity: 10 });
    const order = await crmClient.purchases.create({
      supplier_id: supplier.id,
      product_id: product.id,
      quantity: 1000,
      unit_cost: 20,
      status: 'received',
    });
    const request = (await crmClient.approvals.list()).find((item) => item.entity_id === order.id);
    await crmClient.approvals.decide(request.id, 'approved', '');
    expect(await stockOf(product.id)).toBe(1010);
    await crmClient.approvals.decide(request.id, 'rejected', 'reconsidered');
    expect(await stockOf(product.id)).toBe(10);
  });

  it('rejects a decision other than approved or rejected', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct({ stock_quantity: 10 });
    const order = await crmClient.purchases.create({ supplier_id: supplier.id, product_id: product.id, quantity: 1000, unit_cost: 20, status: 'received' });
    const request = (await crmClient.approvals.list()).find((item) => item.entity_id === order.id);
    await expect(crmClient.approvals.decide(request.id, 'maybe', '')).rejects.toThrow();
    expect((await crmClient.approvals.list()).find((item) => item.id === request.id).status).toBe('pending');
  });
});

describe('quote conversion', () => {
  it('does not create a second sales order when the same quote is converted twice', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'Twice', subtotal: 1 });
    await crmClient.quotes.convertToOrder(quote.id);
    await expect(crmClient.quotes.convertToOrder(quote.id)).rejects.toThrow('This quote has already been converted to an order');
    expect((await crmClient.salesOrders.list()).filter((order) => order.quote_id === quote.id)).toHaveLength(1);
  });

  it('refuses to convert a quote whose approval is pending or rejected', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'Big client', subtotal: 30000 });
    expect(quote.approval_status).toBe('pending');
    await expect(crmClient.quotes.convertToOrder(quote.id)).rejects.toThrow('cannot be converted until it is approved');

    const request = (await crmClient.approvals.list()).find((item) => item.entity_id === quote.id);
    await crmClient.approvals.decide(request.id, 'rejected', 'too rich');
    await expect(crmClient.quotes.convertToOrder(quote.id)).rejects.toThrow('cannot be converted until it is approved');
    expect((await crmClient.salesOrders.list()).some((order) => order.quote_id === quote.id)).toBe(false);
  });
});

describe('contact delete', () => {
  it('removes deals, quotes, orders and activities linked by contact_id only', async () => {
    const contact = await crmClient.entities.Contact.create({ first_name: 'Jane', last_name: 'Roe' });
    const deal = await crmClient.entities.Deal.create({ contact_id: contact.id, contact_name: 'Jane Roe', title: 'mine' });
    const quote = await crmClient.quotes.create({ contact_id: contact.id, customer_name: 'Jane Roe', subtotal: 10 });
    const order = await crmClient.salesOrders.create({ contact_id: contact.id, customer_name: 'Jane Roe', subtotal: 10 });
    const activity = await crmClient.entities.Activity.create({ related_id: contact.id, title: 'call' });

    await crmClient.contacts.delete(contact.id);

    expect((await crmClient.entities.Deal.list()).some((item) => item.id === deal.id)).toBe(false);
    expect((await crmClient.quotes.list()).some((item) => item.id === quote.id)).toBe(false);
    expect((await crmClient.salesOrders.list()).some((item) => item.id === order.id)).toBe(false);
    expect((await crmClient.entities.Activity.list()).some((item) => item.id === activity.id)).toBe(false);
    expect((await crmClient.entities.Contact.list()).some((item) => item.id === contact.id)).toBe(false);
  });

  it('keeps quotes, orders and deals of a different contact that shares the same name', async () => {
    const c1 = await crmClient.entities.Contact.create({ first_name: 'John', last_name: 'Doe' });
    const c2 = await crmClient.entities.Contact.create({ first_name: 'John', last_name: 'Doe' });
    const d1 = await crmClient.entities.Deal.create({ contact_id: c1.id, contact_name: 'John Doe', title: 'one' });
    const d2 = await crmClient.entities.Deal.create({ contact_id: c2.id, contact_name: 'John Doe', title: 'two' });
    const q2 = await crmClient.quotes.create({ contact_id: c2.id, customer_name: 'John Doe', subtotal: 10 });
    const o2 = await crmClient.salesOrders.create({ contact_id: c2.id, customer_name: 'John Doe', subtotal: 10 });

    await crmClient.contacts.delete(c1.id);

    const deals = await crmClient.entities.Deal.list();
    expect(deals.some((item) => item.id === d1.id)).toBe(false);
    expect(deals.some((item) => item.id === d2.id)).toBe(true);
    expect((await crmClient.quotes.list()).some((item) => item.id === q2.id)).toBe(true);
    expect((await crmClient.salesOrders.list()).some((item) => item.id === o2.id)).toBe(true);
  });

  it('throws when the contact does not exist', async () => {
    await expect(crmClient.contacts.delete('missing-id')).rejects.toThrow('Contact record not found');
  });
});

describe('product and supplier delete guards', () => {
  it('blocks deleting a product that has sales history, with the documented message', async () => {
    const product = await makeProduct({ stock_quantity: 5 });
    const sale = await crmClient.sales.create({ product_id: product.id, quantity: 1 });
    await expect(crmClient.products.delete(product.id)).rejects.toThrow(
      'This product has sales or purchase history. Mark it as discontinued/inactive instead.'
    );
    expect((await crmClient.products.list()).some((item) => item.id === product.id)).toBe(true);
    await crmClient.sales.delete(sale.id);
  });

  it('blocks deleting a product that has purchase history', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Supplier' });
    const product = await makeProduct();
    await crmClient.purchases.create({ supplier_id: supplier.id, product_id: product.id, quantity: 1, unit_cost: 1, status: 'ordered' });
    await expect(crmClient.products.delete(product.id)).rejects.toThrow(/sales or purchase history/);
  });

  it('allows deleting a product without history and removes its stock adjustments', async () => {
    const product = await makeProduct({ stock_quantity: 0 });
    await crmClient.stockAdjustments.create({ product_id: product.id, quantity: 2, reason: 'Count' });
    await crmClient.products.delete(product.id);
    expect((await crmClient.products.list()).some((item) => item.id === product.id)).toBe(false);
    expect((await crmClient.stockAdjustments.list()).some((item) => item.product_id === product.id)).toBe(false);
  });

  it('blocks deleting a supplier with purchase order history', async () => {
    const supplier = await crmClient.suppliers.create({ name: 'Acme Supply' });
    const product = await makeProduct();
    const order = await crmClient.purchases.create({ supplier_id: supplier.id, product_id: product.id, quantity: 1, unit_cost: 1, status: 'ordered' });
    await expect(crmClient.suppliers.delete(supplier.id)).rejects.toThrow(
      'This supplier has purchase order history. Mark it as inactive instead.'
    );
    await crmClient.purchases.delete(order.id);
    await crmClient.suppliers.delete(supplier.id);
    expect((await crmClient.suppliers.list()).some((item) => item.id === supplier.id)).toBe(false);
  });
});

describe('sales stock handling', () => {
  it('decrements stock and inventory value on a sale', async () => {
    const product = await makeProduct({ stock_quantity: 10, cost_price: 4 });
    await crmClient.sales.create({ product_id: product.id, quantity: 3 });
    const stored = (await crmClient.products.list()).find((item) => item.id === product.id);
    expect(stored.stock_quantity).toBe(7);
    expect(stored.inventory_value).toBe(28);
  });

  it('refuses a sale larger than the stock on hand and writes nothing', async () => {
    const product = await makeProduct({ stock_quantity: 2 });
    await expect(crmClient.sales.create({ product_id: product.id, quantity: 3 })).rejects.toThrow(
      'Not enough stock available for this sale'
    );
    expect(await stockOf(product.id)).toBe(2);
    expect(await crmClient.sales.list()).toHaveLength(0);
  });

  it('refuses a sale of a discontinued product and a zero quantity', async () => {
    const product = await makeProduct({ status: 'discontinued', stock_quantity: 5 });
    await expect(crmClient.sales.create({ product_id: product.id, quantity: 1 })).rejects.toThrow(
      'Only active products can be sold'
    );
    const active = await makeProduct({ stock_quantity: 5 });
    await expect(crmClient.sales.create({ product_id: active.id, quantity: 0 })).rejects.toThrow(
      'Sale quantity must be greater than zero'
    );
  });

  it('restores stock when a sale is deleted', async () => {
    const product = await makeProduct({ stock_quantity: 10 });
    const sale = await crmClient.sales.create({ product_id: product.id, quantity: 4 });
    await crmClient.sales.delete(sale.id);
    expect(await stockOf(product.id)).toBe(10);
  });

  it('applies a quantity change on update as a net difference', async () => {
    const product = await makeProduct({ stock_quantity: 10 });
    const sale = await crmClient.sales.create({ product_id: product.id, quantity: 2 });
    await crmClient.sales.update(sale.id, { quantity: 5 });
    expect(await stockOf(product.id)).toBe(5);
  });

  it('leaves stock and the stored sale unchanged when an update fails validation', async () => {
    const product = await makeProduct({ stock_quantity: 10 });
    const sale = await crmClient.sales.create({ product_id: product.id, quantity: 1 });
    const before = await stockOf(product.id);
    await expect(crmClient.sales.update(sale.id, { quantity: 1000000 })).rejects.toThrow('Not enough stock');
    expect(await stockOf(product.id)).toBe(before);
    const stored = (await crmClient.sales.list()).find((item) => item.id === sale.id);
    expect(stored.quantity).toBe(1);
  });

  it('does not touch the original product when moving a sale to another product fails on stock', async () => {
    const source = await makeProduct({ stock_quantity: 10 });
    const target = await makeProduct({ stock_quantity: 0 });
    const sale = await crmClient.sales.create({ product_id: source.id, quantity: 2 });
    expect(await stockOf(source.id)).toBe(8);

    await expect(crmClient.sales.update(sale.id, { product_id: target.id, quantity: 2 })).rejects.toThrow(
      'Not enough stock'
    );
    expect(await stockOf(source.id)).toBe(8);
    expect(await stockOf(target.id)).toBe(0);
    const stored = (await crmClient.sales.list()).find((item) => item.id === sale.id);
    expect(stored.product_id).toBe(source.id);
  });
});

describe('payments and sales order status sync', () => {
  it('moves a sales order from unpaid to partial to paid as payments arrive, then back when one is removed', async () => {
    const order = await crmClient.salesOrders.create({ customer_name: 'Pay', subtotal: 100, status: 'confirmed' });
    const read = async () => (await crmClient.salesOrders.list()).find((item) => item.id === order.id);

    expect((await read()).payment_status).toBe('unpaid');

    const first = await crmClient.payments.create({ reference_type: 'sales_order', reference_id: order.id, amount: 40 });
    let current = await read();
    expect(current.payment_status).toBe('partial');
    expect(current.collected_amount).toBe(40);
    expect(current.balance_due).toBe(60);
    expect(current.status).toBe('confirmed');

    const second = await crmClient.payments.create({ reference_type: 'sales_order', reference_id: order.id, amount: 60 });
    current = await read();
    expect(current.payment_status).toBe('paid');
    expect(current.balance_due).toBe(0);
    expect(current.status).toBe('completed');

    await crmClient.payments.delete(second.id);
    current = await read();
    expect(current.payment_status).toBe('partial');
    expect(current.collected_amount).toBe(40);

    await crmClient.payments.delete(first.id);
    current = await read();
    expect(current.payment_status).toBe('unpaid');
    expect(current.collected_amount).toBe(0);
  });

  it('rejects a payment of zero or less', async () => {
    await expect(crmClient.payments.create({ reference_type: 'manual', amount: 0 })).rejects.toThrow(
      'Payment amount must be greater than zero'
    );
  });

  it('moving a payment to another order resyncs both orders', async () => {
    const orderA = await crmClient.salesOrders.create({ customer_name: 'A', subtotal: 100 });
    const orderB = await crmClient.salesOrders.create({ customer_name: 'B', subtotal: 100 });
    const payment = await crmClient.payments.create({ reference_type: 'sales_order', reference_id: orderA.id, amount: 50 });
    const find = async (id) => (await crmClient.salesOrders.list()).find((item) => item.id === id);
    expect((await find(orderA.id)).collected_amount).toBe(50);

    await crmClient.payments.update(payment.id, { reference_id: orderB.id });

    const a = await find(orderA.id);
    const b = await find(orderB.id);
    expect(a.collected_amount).toBe(0);
    expect(a.payment_status).toBe('unpaid');
    expect(b.collected_amount).toBe(50);
    expect(b.balance_due).toBe(50);
    expect(b.payment_status).toBe('partial');
  });

  it('creates one payment for a paid sale and removes it when the sale is no longer paid', async () => {
    const product = await makeProduct({ unit_price: 10, stock_quantity: 10 });
    const sale = await crmClient.sales.create({ product_id: product.id, quantity: 2 });
    const linked = () => crmClient.payments.list().then((items) => items.filter((item) => item.reference_type === 'sale' && item.reference_id === sale.id));
    let payments = await linked();
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(20);

    await crmClient.sales.update(sale.id, { quantity: 3 });
    payments = await linked();
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(30);

    await crmClient.sales.update(sale.id, { payment_status: 'pending' });
    expect(await linked()).toHaveLength(0);
  });
});

describe('quote and sales order totals on update', () => {
  it('recomputes the total when the subtotal changes and no total is supplied', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'T', subtotal: 100, tax_rate: 10 });
    expect(quote.total_amount).toBe(110);
    const updated = await crmClient.quotes.update(quote.id, { subtotal: 200 });
    expect(updated.tax_amount).toBe(20);
    expect(updated.total_amount).toBe(220);
  });

  it('keeps an explicit total_amount when the caller supplies one', async () => {
    const quote = await crmClient.quotes.create({ customer_name: 'T', subtotal: 100, tax_rate: 10 });
    const updated = await crmClient.quotes.update(quote.id, { discount_amount: 5, total_amount: 999 });
    expect(updated.total_amount).toBe(999);
  });

  it('recomputes sales order totals on discount change', async () => {
    const order = await crmClient.salesOrders.create({ customer_name: 'O', subtotal: 100, tax_rate: 10 });
    expect(order.total_amount).toBe(110);
    const updated = await crmClient.salesOrders.update(order.id, { discount_amount: 10 });
    expect(updated.total_amount).toBe(100);
  });
});

describe('corrupt stored data guard', () => {
  it('reads return an empty list for an undecodable entity and a write throws without overwriting the raw value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('riskflow_crm:Quote', 'enc::garbage');

    expect(await crmClient.quotes.list()).toEqual([]);

    await expect(crmClient.quotes.create({ customer_name: 'Lost?', subtotal: 1 })).rejects.toThrow(
      /Refusing to overwrite Quote data/
    );
    expect(rawStored('Quote')).toBe('enc::garbage');

    // Repeated attempts keep refusing and keep the original bytes.
    await expect(crmClient.quotes.create({ customer_name: 'Again', subtotal: 1 })).rejects.toThrow(/Refusing/);
    expect(rawStored('Quote')).toBe('enc::garbage');
  });

  it('treats decodable JSON that is not a list as corrupt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('riskflow_crm:Quote', '{"not":"a list"}');
    expect(await crmClient.quotes.list()).toEqual([]);
    await expect(crmClient.quotes.create({ customer_name: 'X', subtotal: 1 })).rejects.toThrow(/Refusing to overwrite Quote/);
    expect(rawStored('Quote')).toBe('{"not":"a list"}');
  });

  it('keeps corruption isolated to the damaged entity', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await makeProduct({ name: 'Healthy' });
    window.localStorage.setItem('riskflow_crm:Quote', 'enc::garbage');
    const products = await crmClient.products.list();
    expect(products.map((item) => item.name)).toEqual(['Healthy']);
    await expect(crmClient.products.create({ name: 'Still works', sku: 'OK-1' })).resolves.toMatchObject({ name: 'Still works' });
  });

  it('refuses to export while any entity is undecodable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    window.localStorage.setItem('riskflow_crm:Quote', 'enc::garbage');
    await expect(crmClient.backups.exportAll()).rejects.toThrow(/Cannot export: stored data for Quote/);
  });

  it('stores records encrypted at rest when local encryption is enabled', async () => {
    await makeProduct({ name: 'Secret widget' });
    expect(rawStored('Product').startsWith('enc::')).toBe(true);
    expect(rawStored('Product')).not.toContain('Secret widget');
  });

  it('a valid import replaces a corrupt entity and keeps the damaged raw copy in the backup slot', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await crmClient.users.create({ full_name: 'Ada Admin', email: 'ada@test.local', role: 'admin', password: 'ada-pass-1' });
    await crmClient.quotes.create({ customer_name: 'Snapshot quote', subtotal: 5 });
    const snapshot = await crmClient.backups.exportAll();

    window.localStorage.setItem('riskflow_crm:Quote', 'enc::garbage');
    await crmClient.backups.importAll(snapshot);

    const quotes = await crmClient.quotes.list();
    expect(quotes.map((item) => item.customer_name)).toEqual(['Snapshot quote']);
    expect(rawStored('Quote')).not.toBe('enc::garbage');
    expect(window.localStorage.getItem('riskflow_crm_backup:Quote')).toBe('enc::garbage');
  });
});

describe('backups.importAll validation', () => {
  const activeAdminPayload = (extra = {}) => ({
    AppUser: [{ id: 'user-1', email: 'ada@test.local', role: 'admin', status: 'active', full_name: 'Ada' }],
    ...extra,
  });

  it.each([
    ['null snapshot', null],
    ['missing payload', { profile: {} }],
    ['payload that is not an object', { payload: [] }],
    ['entity that is not a list', { payload: activeAdminPayload({ Quote: { id: 'x' } }) }],
    ['record without an id', { payload: activeAdminPayload({ Quote: [{ customer_name: 'no id' }] }) }],
    ['record with a non-string id', { payload: activeAdminPayload({ Quote: [{ id: 42 }] }) }],
  ])('rejects a malformed snapshot: %s', async (_label, snapshot) => {
    await expect(crmClient.backups.importAll(snapshot)).rejects.toThrow(/Invalid backup file/);
  });

  it('rejects a snapshot with no active admin and leaves existing data untouched', async () => {
    await crmClient.quotes.create({ customer_name: 'Keep me', subtotal: 1 });
    const before = rawStored('Quote');
    const snapshot = { payload: { AppUser: [{ id: 'u1', role: 'user', status: 'active' }] } };
    await expect(crmClient.backups.importAll(snapshot)).rejects.toThrow(/at least one active admin/);
    expect(rawStored('Quote')).toBe(before);
  });

  it('rejects a snapshot whose only admin is inactive', async () => {
    const snapshot = { payload: { AppUser: [{ id: 'u1', role: 'admin', status: 'inactive' }] } };
    await expect(crmClient.backups.importAll(snapshot)).rejects.toThrow(/at least one active admin/);
  });

  it('rejects a snapshot with no AppUser section at all', async () => {
    await expect(crmClient.backups.importAll({ payload: { Quote: [] } })).rejects.toThrow(/at least one active admin/);
  });

  it('accepts a valid snapshot with an active admin and writes the records', async () => {
    await crmClient.backups.importAll({
      payload: activeAdminPayload({ Warehouse: [{ id: 'wh-1', name: 'Imported', code: 'IMP' }] }),
    });
    const warehouses = await crmClient.warehouses.list();
    expect(warehouses.map((item) => item.name)).toEqual(['Imported']);
    expect((await crmClient.users.list()).map((user) => user.email)).toEqual(['ada@test.local']);
  });
});

describe('auth', () => {
  const seedOwner = (overrides = {}) =>
    seedProfile({
      adminName: 'Olive Owner',
      adminEmail: 'Owner@Acme.test',
      adminPassword: 'Correct-Horse-1',
      ...overrides,
    });

  it('signs in with the correct password and rejects an incorrect one with the same generic message', async () => {
    seedOwner();
    const user = await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');
    expect(user.role).toBe('admin');
    expect(user.email).toBe('owner@acme.test');

    await expect(crmClient.auth.login('owner@acme.test', 'wrong-password')).rejects.toThrow('Invalid email or password');
    await expect(crmClient.auth.login('nobody@acme.test', 'Correct-Horse-1')).rejects.toThrow('Invalid email or password');
  });

  it('matches the email case-insensitively', async () => {
    seedOwner();
    await expect(crmClient.auth.login('OWNER@ACME.TEST', 'Correct-Horse-1')).resolves.toMatchObject({ role: 'admin' });
  });

  it('reads the legacy ownerEmail / ownerPassword / ownerName profile fields', async () => {
    seedProfile({ ownerName: 'Legacy Owner', ownerEmail: 'legacy@acme.test', ownerPassword: 'Legacy-Pass-9' });
    const user = await crmClient.auth.login('legacy@acme.test', 'Legacy-Pass-9');
    expect(user.full_name).toBe('Legacy Owner');
  });

  it('stores the owner password as a PBKDF2 hash, not as plaintext', async () => {
    seedOwner();
    await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');
    const [user] = await crmClient.users.list();
    expect(user.password_hash.startsWith('pbkdf2$')).toBe(true);
    expect(user.password_hash).not.toContain('Correct-Horse-1');
  });

  it('scrubs the plaintext admin password from the stored profile after the owner user is created', async () => {
    seedOwner();
    await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');

    const storedProfile = JSON.parse(window.localStorage.getItem(PROFILE_KEY));
    expect(storedProfile.adminPassword).toBe('');
    expect(storedProfile.ownerPassword).toBe('');
    expect(window.localStorage.getItem(PROFILE_KEY)).not.toContain('Correct-Horse-1');
    // The owner can still sign in with the password after the plaintext copy is gone.
    await expect(crmClient.auth.login('owner@acme.test', 'Correct-Horse-1')).resolves.toMatchObject({ role: 'admin' });
  });

  it('still signs in after a fresh module load, because the hash is persisted', async () => {
    seedOwner();
    await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');
    vi.resetModules();
    const reloaded = await import('./crmClient.js');
    await expect(reloaded.crmClient.auth.login('owner@acme.test', 'Correct-Horse-1')).resolves.toMatchObject({ role: 'admin' });
    await expect(reloaded.crmClient.auth.login('owner@acme.test', 'nope')).rejects.toThrow('Invalid email or password');
  });

  it('auth.me requires a session and returns the signed-in user', async () => {
    seedOwner();
    await expect(crmClient.auth.me()).rejects.toThrow('auth_required');
    await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');
    await expect(crmClient.auth.me()).resolves.toMatchObject({ email: 'owner@acme.test' });
    await crmClient.auth.logout();
    await expect(crmClient.auth.me()).rejects.toThrow('auth_required');
  });

  it('refuses to store a "plain:" password when Web Crypto is unavailable', async () => {
    const subtle = window.crypto.subtle;
    Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true });
    try {
      await expect(
        crmClient.users.create({ full_name: 'No Crypto', email: 'nc@test.local', role: 'user', password: 'plain-text-pass' })
      ).rejects.toThrow('Secure password hashing is not available in this browser');
      expect((await crmClient.users.list()).some((user) => user.email === 'nc@test.local')).toBe(false);
    } finally {
      Object.defineProperty(window.crypto, 'subtle', { value: subtle, configurable: true });
    }
  });

  it('never verifies a "plain:" stored hash', async () => {
    await expect(api.verifyPassword('plain-text-pass', 'plain:plain-text-pass')).resolves.toBe(false);
    await expect(api.verifyPassword('', 'plain:')).resolves.toBe(false);
  });

  it('signs out even when the audit log cannot be written, and clears the session', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    seedOwner();
    await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');
    window.localStorage.setItem('riskflow_crm:AuditLog', 'enc::garbage');

    await expect(crmClient.auth.logout()).resolves.toBeUndefined();
    await expect(crmClient.auth.me()).rejects.toThrow('auth_required');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('signs in even when the audit log cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    seedOwner();
    await crmClient.auth.login('owner@acme.test', 'Correct-Horse-1');
    await crmClient.auth.logout();
    window.localStorage.setItem('riskflow_crm:AuditLog', 'enc::garbage');

    await expect(crmClient.auth.login('owner@acme.test', 'Correct-Horse-1')).resolves.toMatchObject({ role: 'admin' });
    await expect(crmClient.auth.me()).resolves.toMatchObject({ email: 'owner@acme.test' });
  });
});

describe('backup export does not carry profile password hashes', () => {
  it('omits the app lock and AI chat password hashes and any plaintext passwords from the exported profile', async () => {
    const appPasswordHash = await api.hashPassword('lock-pass-1');
    const aiGeneralPasswordHash = await api.hashPassword('ai-pass-1');
    seedProfile({
      appPasswordHash,
      aiGeneralPasswordHash,
      adminPassword: 'leftover-admin-pass',
      ownerPassword: 'leftover-owner-pass',
      openaiApiKey: 'sk-test-key',
    });

    const snapshot = await crmClient.backups.exportAll();
    const serialized = JSON.stringify(snapshot);

    expect(snapshot.profile).not.toHaveProperty('appPasswordHash');
    expect(snapshot.profile).not.toHaveProperty('aiGeneralPasswordHash');
    expect(snapshot.profile).not.toHaveProperty('adminPassword');
    expect(snapshot.profile).not.toHaveProperty('ownerPassword');
    expect(serialized).not.toContain(appPasswordHash);
    expect(serialized).not.toContain(aiGeneralPasswordHash);
    expect(serialized).not.toContain('leftover-admin-pass');
    expect(serialized).not.toContain('leftover-owner-pass');
    // Existing behaviour: AI keys are still exported so a restored profile keeps working.
    expect(snapshot.profile.openaiApiKey).toBe('sk-test-key');
    expect(snapshot.profile.companyName).toBe('Test Co');
  });
});
