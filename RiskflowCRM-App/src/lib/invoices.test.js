import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Records every jsPDF call so the tests can inspect what would be drawn and saved.
const pdf = vi.hoisted(() => ({ docs: [], tables: [] }));

vi.mock('jspdf', () => {
  class FakeJsPDF {
    constructor() {
      this.calls = [];
      this.lastAutoTable = undefined;
      pdf.docs.push(this);
      return new Proxy(this, {
        get(target, prop) {
          if (prop in target) return target[prop];
          return (...args) => {
            target.calls.push({ method: prop, args });
          };
        },
      });
    }

    splitTextToSize(text) {
      return [text];
    }
  }
  return { default: FakeJsPDF };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn((doc, options) => {
    pdf.tables.push(options);
    doc.lastAutoTable = { finalY: 120 };
  }),
}));

import {
  generateDealInvoicePdf,
  generateQuotePdf,
  generateSaleInvoicePdf,
  generateSalesOrderInvoicePdf,
} from './invoices';

const lastDoc = () => pdf.docs.at(-1);
const textsOf = (doc = lastDoc()) => doc.calls.filter((call) => call.method === 'text').map((call) => call.args[0]);
const savedName = (doc = lastDoc()) => doc.calls.find((call) => call.method === 'save')?.args[0];
const lastTable = () => pdf.tables.at(-1);

const profile = {
  companyName: 'Acme Ltd',
  companyEmail: 'billing@acme.test',
  companyAddress: '1 Main St',
  taxRate: 10,
};

beforeEach(() => {
  pdf.docs.length = 0;
  pdf.tables.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const usd = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

describe('generateSaleInvoicePdf', () => {
  const sale = {
    id: 'a1b2c3d4-0000-0000-0000-000000000000',
    invoice_number: 'INV-1001',
    product_name: 'Widget Pro',
    customer_name: 'Bob Buyer',
    quantity: 2,
    unit_price: 50,
    subtotal: 100,
    tax_rate: 10,
    tax_amount: 10,
    total_amount: 110,
    sale_date: '2024-03-01',
    channel: 'web',
  };

  it('draws the brand header, invoice number and today\'s date', () => {
    generateSaleInvoicePdf({ profile, sale, currencyInfo: { code: 'USD' } });
    const texts = textsOf();
    expect(texts).toContain('Acme Ltd');
    expect(texts).toContain('Sales Invoice');
    expect(texts).toContain('No: INV-1001');
    expect(texts).toContain('Date: 2024-03-15');
  });

  it('formats subtotal, tax and grand total in the document currency', () => {
    generateSaleInvoicePdf({ profile, sale, currencyInfo: { code: 'USD' } });
    const texts = textsOf();
    expect(texts).toContain('Subtotal');
    expect(texts).toContain('Tax (10%)');
    expect(texts).toContain('Grand Total');
    expect(texts).toContain(usd(100));
    expect(texts).toContain(usd(10));
    expect(texts).toContain(usd(110));
  });

  it('puts the line item into the table with quantity and formatted amounts', () => {
    generateSaleInvoicePdf({ profile, sale, currencyInfo: { code: 'USD' } });
    expect(lastTable().head).toEqual([['Description', 'Qty', 'Unit Price', 'Amount']]);
    expect(lastTable().body).toEqual([['Widget Pro', '2', usd(50), usd(100)]]);
  });

  it('saves the file with a sanitised product name', () => {
    generateSaleInvoicePdf({ profile, sale: { ...sale, product_name: 'Widget/Pro: v2' }, currencyInfo: { code: 'USD' } });
    expect(savedName()).toBe('widget-pro--v2.pdf');
  });

  it('uses the sales-invoice fallback filename and document number when fields are missing', () => {
    generateSaleInvoicePdf({
      profile,
      sale: { id: 'abcdef123456', total_amount: 5, subtotal: 5, tax_rate: 0 },
      currencyInfo: { code: 'USD' },
    });
    expect(savedName()).toBe('sales-invoice.pdf');
    expect(textsOf()).toContain('No: SALE-ABCDEF12');
  });

  it('defaults the customer to Walk-in Customer', () => {
    generateSaleInvoicePdf({ profile, sale: { ...sale, customer_name: '' }, currencyInfo: { code: 'USD' } });
    expect(textsOf()).toContain('Walk-in Customer');
  });

  it('labels tax as GST or VAT when the business has those numbers', () => {
    generateSaleInvoicePdf({ profile: { ...profile, gstNumber: 'GST-1' }, sale, currencyInfo: { code: 'USD' } });
    expect(textsOf()).toContain('GST (10%)');

    pdf.docs.length = 0;
    generateSaleInvoicePdf({ profile: { ...profile, vatNumber: 'VAT-1' }, sale, currencyInfo: { code: 'USD' } });
    expect(textsOf()).toContain('VAT (10%)');
  });

  it('uses the sale tax rate over the profile default and derives tax when tax_amount is absent', () => {
    const { tax_amount: _ignored, ...withoutTaxAmount } = sale;
    generateSaleInvoicePdf({
      profile: { ...profile, taxRate: 99 },
      sale: { ...withoutTaxAmount, tax_rate: 20, subtotal: 100, total_amount: 120 },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain('Tax (20%)');
    expect(texts).toContain(usd(20));
  });

  it('formats amounts with the currency locale and zero decimals for JPY', () => {
    generateSaleInvoicePdf({
      profile,
      sale: { ...sale, subtotal: 1000, tax_amount: 100, total_amount: 1100, unit_price: 1000, quantity: 1 },
      currencyInfo: { code: 'JPY', locale: 'ja-JP' },
    });
    const expected = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(1100);
    expect(textsOf()).toContain(expected);
  });

  it('applies the convertAmount hook to every money value', () => {
    generateSaleInvoicePdf({
      profile,
      sale,
      currencyInfo: { code: 'USD' },
      convertAmount: (value) => value * 2,
    });
    expect(textsOf()).toContain(usd(220));
  });

  it('prints bank details and the custom footer note when provided', () => {
    generateSaleInvoicePdf({
      profile: { ...profile, bankName: 'First Bank', bankIfsc: 'IFSC9', invoiceFooterNote: 'Pay within 30 days' },
      sale,
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain('Bank: First Bank');
    expect(texts).toContain('IFSC/Routing: IFSC9');
    expect(texts).toContainEqual(['Pay within 30 days']);
    expect(texts).not.toContain('Thank you for your business.');
  });

  it('falls back to the thank-you footer when no note is set', () => {
    generateSaleInvoicePdf({ profile, sale, currencyInfo: { code: 'USD' } });
    expect(textsOf()).toContain('Thank you for your business.');
  });

  it('adds the logo when a data URL is supplied', () => {
    generateSaleInvoicePdf({
      profile: { ...profile, logoDataUrl: 'data:image/png;base64,AAAA' },
      sale,
      currencyInfo: { code: 'USD' },
    });
    const images = lastDoc().calls.filter((call) => call.method === 'addImage');
    expect(images[0].args.slice(0, 2)).toEqual(['data:image/png;base64,AAAA', 'PNG']);
  });

  it('prints subtotal and tax that add up to the grand total when subtotal is missing', () => {
    generateSaleInvoicePdf({
      profile,
      sale: { id: 'walkin0001', product_name: 'Widget', quantity: 1, unit_price: 110, total_amount: 110, tax_rate: 10 },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain(usd(100));
    expect(texts).toContain(usd(10));
    expect(texts).toContain(usd(110));
    expect(texts).not.toContain(usd(121));
    expect(lastTable().body).toEqual([['Widget', '1', usd(110), usd(100)]]);
  });

  it('splits a missing subtotal using the stored tax_amount, keeping the grand total as total_amount', () => {
    generateSaleInvoicePdf({
      profile,
      sale: { id: 'walkin0002', product_name: 'Widget', quantity: 1, total_amount: 110, tax_rate: 10, tax_amount: 15 },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain(usd(95));
    expect(texts).toContain(usd(15));
    expect(texts).toContain(usd(110));
  });

  it('does not add tax when subtotal is missing and the tax rate is zero', () => {
    generateSaleInvoicePdf({
      profile: { ...profile, taxRate: 0 },
      sale: { id: 'walkin0003', product_name: 'Widget', quantity: 1, total_amount: 80, tax_rate: 0 },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain(usd(80));
    expect(texts).toContain(usd(0));
  });
});

describe('generateDealInvoicePdf', () => {
  it('splits the deal value into net subtotal and tax using the profile tax rate', () => {
    generateDealInvoicePdf({
      profile,
      deal: { id: 'deadbeef-1234', title: 'Big Deal', value: 1100, contact_name: 'Carol', stage: 'proposal' },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain('CRM Invoice');
    expect(texts).toContain('No: CRM-DEADBEEF');
    expect(texts).toContain(usd(1000));
    expect(texts).toContain(usd(100));
    expect(texts).toContain(usd(1100));
    expect(savedName()).toBe('big-deal.pdf');
  });

  it('treats the full value as subtotal when no tax rate is configured', () => {
    generateDealInvoicePdf({
      profile: { companyName: 'X' },
      deal: { id: 'abc', title: 'Deal', value: 500 },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain(usd(500));
    expect(texts).toContain(usd(0));
    expect(texts).toContain('Tax (0%)');
  });

  it('shows a zero-value deal as zero rather than a phantom $1 subtotal', () => {
    generateDealInvoicePdf({
      profile,
      deal: { id: 'zero0001', title: 'Free trial', value: 0 },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain(usd(0));
    expect(texts).not.toContain(usd(1));
  });

  it('uses the stored document number when present', () => {
    generateDealInvoicePdf({
      profile,
      deal: { document_number: 'DOC-77', id: 'abc', title: 'Deal', value: 110 },
      currencyInfo: { code: 'USD' },
    });
    expect(textsOf()).toContain('No: DOC-77');
  });
});

describe('generateQuotePdf', () => {
  const quote = {
    id: 'q1234567-aaaa',
    title: 'Website redesign',
    customer_name: 'Dana',
    subtotal: 2000,
    tax_rate: 5,
    tax_amount: 100,
    discount_amount: 50,
    total_amount: 2050,
    quote_date: '2024-03-10',
    valid_until: '2024-04-10',
  };

  it('renders subtotal, tax, discount and grand total from the stored quote', () => {
    generateQuotePdf({ profile, quote, currencyInfo: { code: 'USD' } });
    const texts = textsOf();
    expect(texts).toContain('Quote');
    expect(texts).toContain('No: QT-Q1234567');
    expect(texts).toContain('Tax (5%)');
    expect(texts).toContain('Discount');
    expect(texts).toContain(usd(50));
    expect(texts).toContain(usd(2050));
    expect(texts).toContain('Quote Date: 2024-03-10');
    expect(texts).toContain('Valid Until: 2024-04-10');
  });

  it('uses the quote table row for the quoted line and saves by document number', () => {
    generateQuotePdf({ profile, quote: { ...quote, document_number: 'Q-9' }, currencyInfo: { code: 'USD' } });
    expect(lastTable().body).toEqual([['Website redesign', '1', usd(2000), usd(2000)]]);
    expect(savedName()).toBe('q-9.pdf');
  });

  it('shows the discount as zero when none is stored', () => {
    generateQuotePdf({ profile, quote: { ...quote, discount_amount: undefined }, currencyInfo: { code: 'USD' } });
    expect(textsOf()).toContain(usd(0));
  });
});

describe('generateSalesOrderInvoicePdf', () => {
  it('renders a Sales Order document with its status and totals', () => {
    generateSalesOrderInvoicePdf({
      profile: { ...profile, vatNumber: 'VAT-9' },
      order: {
        id: 'order0001',
        title: 'Monthly supply',
        customer_name: 'Eve',
        order_date: '2024-03-02',
        status: 'confirmed',
        subtotal: 300,
        tax_rate: 20,
        tax_amount: 60,
        discount_amount: 0,
        total_amount: 360,
      },
      currencyInfo: { code: 'USD' },
    });
    const texts = textsOf();
    expect(texts).toContain('Sales Order');
    expect(texts).toContain('No: SO-ORDER000');
    expect(texts).toContain('Order Date: 2024-03-02');
    expect(texts).toContain('Status: confirmed');
    expect(texts).toContain('VAT (20%)');
    expect(texts).toContain(usd(360));
    expect(savedName()).toBe('sales-order.pdf');
  });
});
