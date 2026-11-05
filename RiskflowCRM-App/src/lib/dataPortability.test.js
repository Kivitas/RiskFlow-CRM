import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// jsdom's TextEncoder returns Uint8Arrays from another realm, which fflate rejects as binary input.
// Swap in a Node-realm encoder before fflate is loaded so ODS zip output can be inspected.
vi.hoisted(() => {
  globalThis.TextEncoder = class {
    encode(input = '') {
      return Uint8Array.from(Buffer.from(String(input), 'utf8'));
    }
  };
  globalThis.TextDecoder = class {
    decode(bytes = new Uint8Array()) {
      return Buffer.from(bytes).toString('utf8');
    }
  };
});

vi.mock('@/api/crmClient', () => {
  const empty = () => ({ list: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) });
  return {
    crmClient: {
      entities: {
        Contact: empty(),
        Deal: empty(),
        RiskAssessment: empty(),
        Sale: empty(),
      },
      products: empty(),
      sales: empty(),
      suppliers: empty(),
      purchases: empty(),
      expenses: empty(),
      quotes: empty(),
      salesOrders: empty(),
      payments: empty(),
      users: empty(),
      approvals: empty(),
      audit: empty(),
    },
  };
});

// jsPDF is only exercised for its own output; these tests do not render PDFs.
vi.mock('jspdf', () => ({ default: vi.fn() }));
vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

import { unzipSync, strFromU8 } from 'fflate';
import { crmClient } from '@/api/crmClient';
import {
  DATASETS,
  IMPORT_TARGETS,
  exportRowsToCsv,
  exportRowsToOds,
  getDatasetByKey,
  importRowsToDataset,
  normalizeRows,
  parseSpreadsheetFile,
} from './dataPortability';

// jsdom Blobs are not understood by Node's Response, so read them with FileReader.
const readBlobAs = (blob, method) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader[method](blob);
  });
const readBlob = (blob) => readBlobAs(blob, 'readAsText');
const lastBytes = () => lastBlob().parts[0];
const bytesToBuffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

let downloads;
const NativeBlob = globalThis.Blob;

beforeEach(() => {
  downloads = [];
  // jsdom's Blob stringifies Node-realm typed arrays, so keep the original parts for binary checks.
  globalThis.Blob = class CapturingBlob extends NativeBlob {
    constructor(parts, options) {
      super(parts, options);
      this.parts = parts;
    }
  };
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
  // Capture each download instead of letting jsdom navigate.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    downloads.push({ filename: this.download, blob: URL.createObjectURL.mock.calls.at(-1)?.[0] });
  });
});

afterEach(() => {
  globalThis.Blob = NativeBlob;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const lastBlob = () => {
  // createObjectURL receives the Blob; grab the most recent one.
  return URL.createObjectURL.mock.calls.at(-1)[0];
};

describe('normalizeRows', () => {
  it('converts null/undefined to empty strings and keeps primitives', () => {
    expect(normalizeRows([{ a: null, b: undefined, c: 0, d: false, e: 'x' }])).toEqual([
      { a: '', b: '', c: 0, d: false, e: 'x' },
    ]);
  });

  it('joins arrays with "; " and recursively normalises their items', () => {
    expect(normalizeRows([{ tags: ['a', null, 'c'] }])).toEqual([{ tags: 'a; ; c' }]);
  });

  it('JSON-encodes plain objects', () => {
    expect(normalizeRows([{ meta: { id: 1, ok: true } }])).toEqual([{ meta: '{"id":1,"ok":true}' }]);
  });

  it('does not mutate the input rows', () => {
    const input = [{ tags: ['x'] }];
    normalizeRows(input);
    expect(input).toEqual([{ tags: ['x'] }]);
  });
});

describe('exportRowsToCsv', () => {
  it('writes a header row and CRLF-separated data rows, then downloads label.csv', async () => {
    exportRowsToCsv([{ name: 'Ann', qty: 2 }, { name: 'Ben', qty: 3 }], 'contacts');

    expect(downloads).toHaveLength(1);
    expect(downloads[0].filename).toBe('contacts.csv');
    const text = await readBlob(lastBlob());
    expect(text).toBe('name,qty\r\nAnn,2\r\nBen,3');
  });

  it('quotes cells containing commas, quotes, or newlines and doubles embedded quotes', async () => {
    exportRowsToCsv([{ note: 'a, b', quote: 'say "hi"', multi: 'line1\nline2', plain: 'ok' }], 'escape');
    const text = await readBlob(lastBlob());
    expect(text).toBe(
      'note,quote,multi,plain\r\n"a, b","say ""hi""","line1\nline2",ok'
    );
  });

  it('quotes carriage returns too', async () => {
    exportRowsToCsv([{ v: 'a\rb' }], 'cr');
    expect(await readBlob(lastBlob())).toBe('v\r\n"a\rb"');
  });

  it('writes an empty file when there are no rows', async () => {
    exportRowsToCsv([], 'empty');
    expect(downloads[0].filename).toBe('empty.csv');
    expect(await readBlob(lastBlob())).toBe('');
  });

  it('serialises nested values before escaping them', async () => {
    exportRowsToCsv([{ items: ['a,b', 'c'], obj: { k: 'v' } }], 'nested');
    expect(await readBlob(lastBlob())).toBe('items,obj\r\n"a,b; c","{""k"":""v""}"');
  });

  it('includes columns that only appear in later rows, in first-seen order', async () => {
    exportRowsToCsv([{ a: 1 }, { a: 2, b: 3 }], 'x');
    expect(await readBlob(lastBlob())).toBe('a,b\r\n1,\r\n2,3');

    exportRowsToCsv([{ b: 1 }, { a: 2, b: 3, c: 4 }], 'order');
    expect(await readBlob(lastBlob())).toBe('b,a,c\r\n1,,\r\n3,2,4');
  });

  it('prefixes text cells that start with a formula character with a single quote', async () => {
    exportRowsToCsv([{ f: '=1+1', at: '@cmd', tab: '\tx', minus: '-abc', num: '-12.5', plus: '+5', n: -3 }], 'inj');
    expect(await readBlob(lastBlob())).toBe("f,at,tab,minus,num,plus,n\r\n'=1+1,'@cmd,'\tx,'-abc,-12.5,+5,-3");
  });

  it('round-trips neutralised formula cells back to their original text', async () => {
    const original = [{ f: '=1+1', minus: '-abc', num: '-12.5' }];
    exportRowsToCsv(original, 'inj-rt');
    const text = await readBlob(lastBlob());
    const parsed = await parseSpreadsheetFile({ name: 'inj-rt.csv', text: async () => text });
    expect(parsed.rows).toEqual([{ f: '=1+1', minus: '-abc', num: '-12.5' }]);
  });
});

describe('exportRowsToOds', () => {
  it('produces a zipped ODS whose content.xml holds the header and escaped cell values', async () => {
    exportRowsToOds([{ name: 'A & B <x>', amount: 5 }], 'report');

    expect(downloads[0].filename).toBe('report.ods');
    const bytes = lastBytes();
    const files = unzipSync(bytes);
    const content = strFromU8(files['content.xml']);
    expect(content).toContain('<text:p>name</text:p>');
    expect(content).toContain('<text:p>A &amp; B &lt;x&gt;</text:p>');
    expect(content).toContain('<text:p>5</text:p>');
    expect(strFromU8(files.mimetype)).toBe('application/vnd.oasis.opendocument.spreadsheet');
  });

  it('writes a "No data" placeholder column when there are no rows', async () => {
    exportRowsToOds([], 'none');
    const bytes = lastBytes();
    const content = strFromU8(unzipSync(bytes)['content.xml']);
    expect(content).toContain('<text:p>No data</text:p>');
  });

  it('uses the union of row keys as columns, in first-seen order', async () => {
    exportRowsToOds([{ a: 1 }, { a: 2, b: 3 }], 'u');
    const result = await parseSpreadsheetFile({ name: 'u.ods', arrayBuffer: async () => bytesToBuffer(lastBytes()) });
    expect(result.columns).toEqual(['a', 'b']);
    expect(result.rows).toEqual([
      { a: '1', b: '' },
      { a: '2', b: '3' },
    ]);
  });

  it('neutralises formula-like text cells and leaves numeric values untouched', async () => {
    exportRowsToOds([{ f: '=SUM(A1)', n: -12.5, s: '-12.5' }], 'inj');
    const content = strFromU8(unzipSync(lastBytes())['content.xml']);
    expect(content).toContain('<text:p>&apos;=SUM(A1)</text:p>');
    expect(content).toContain('<text:p>-12.5</text:p>');
  });

  it('reads neutralised ODS formula cells back to their original text', async () => {
    exportRowsToOds([{ f: '=SUM(A1)', s: '-12.5' }], 'inj-rt');
    const result = await parseSpreadsheetFile({ name: 'inj-rt.ods', arrayBuffer: async () => bytesToBuffer(lastBytes()) });
    expect(result.rows).toEqual([{ f: '=SUM(A1)', s: '-12.5' }]);
  });
});

describe('parseSpreadsheetFile: CSV', () => {
  const csvFile = (name, text) => ({ name, text: async () => text });

  it('parses headers and rows into objects, skipping blank lines and trimming headers', async () => {
    const result = await parseSpreadsheetFile(csvFile('people.csv', ' Name , Email \r\nAnn,ann@x.com\r\n\r\nBen,\r\n'));

    expect(result.sheetName).toBe('people.csv');
    expect(result.workbook).toBeNull();
    expect(result.columns).toEqual(['Name', 'Email']);
    expect(result.rows).toEqual([
      { Name: 'Ann', Email: 'ann@x.com' },
      { Name: 'Ben', Email: '' },
    ]);
  });

  it('keeps commas, doubled quotes, and newlines inside quoted cells', async () => {
    const result = await parseSpreadsheetFile(csvFile('q.csv', 'a,b\n"x, y","say ""hi"""\n"line1\nline2",z\n'));
    expect(result.rows).toEqual([
      { a: 'x, y', b: 'say "hi"' },
      { a: 'line1\nline2', b: 'z' },
    ]);
  });

  it('names blank headers "Column N"', async () => {
    const result = await parseSpreadsheetFile(csvFile('h.csv', 'a,,c\n1,2,3\n'));
    expect(result.columns).toEqual(['a', 'Column 2', 'c']);
  });

  it('round-trips exported CSV back to the same values', async () => {
    const original = [
      { title: 'Deal, big', note: 'He said "go"', multi: 'a\nb' },
      { title: 'Deal 2', note: '', multi: 'plain' },
    ];
    exportRowsToCsv(original, 'rt');
    const text = await readBlob(lastBlob());
    const parsed = await parseSpreadsheetFile(csvFile('rt.csv', text));
    expect(parsed.rows).toEqual(original);
  });

  it('returns no rows for a header-only file', async () => {
    const result = await parseSpreadsheetFile(csvFile('only.csv', 'a,b\n'));
    expect(result.rows).toEqual([]);
    expect(result.columns).toEqual([]);
  });
});

describe('parseSpreadsheetFile: ODS', () => {
  it('reads back a file produced by exportRowsToOds', async () => {
    exportRowsToOds([{ id: 'r1', value: '42' }, { id: 'r2', value: 'x & y' }], 'roundtrip');
    const buffer = bytesToBuffer(lastBytes());

    const result = await parseSpreadsheetFile({ name: 'roundtrip.ods', arrayBuffer: async () => buffer });
    expect(result.columns).toEqual(['id', 'value']);
    expect(result.rows).toEqual([
      { id: 'r1', value: '42' },
      { id: 'r2', value: 'x & y' },
    ]);
  });

  it('rejects an ODS archive without content.xml', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const bytes = zipSync({ 'other.xml': strToU8('<x/>') });
    await expect(
      parseSpreadsheetFile({ name: 'bad.ods', arrayBuffer: async () => bytes.buffer })
    ).rejects.toThrow('Invalid ODS file: content.xml missing.');
  });
});

describe('parseSpreadsheetFile: unsupported files', () => {
  it.each(['xls', 'xlsx'])('asks for an export when given a .%s workbook', async (ext) => {
    await expect(parseSpreadsheetFile({ name: `book.${ext}` })).rejects.toThrow(
      'Excel workbook files are not imported directly. Save/export the sheet as .ods or .csv and try again.'
    );
  });

  it('rejects other extensions', async () => {
    await expect(parseSpreadsheetFile({ name: 'notes.pdf' })).rejects.toThrow('Unsupported file type. Use .ods or .csv.');
  });

  it('treats the extension case-insensitively', async () => {
    const result = await parseSpreadsheetFile({ name: 'DATA.CSV', text: async () => 'a\n1\n' });
    expect(result.rows).toEqual([{ a: '1' }]);
  });
});

describe('datasets and targets', () => {
  it('has unique dataset keys and getDatasetByKey falls back to the first dataset', () => {
    const keys = DATASETS.map((dataset) => dataset.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getDatasetByKey('contacts').label).toBe('Contacts');
    expect(getDatasetByKey('nope')).toBe(DATASETS[0]);
  });

  it('lists analysis-only as the first import target', () => {
    expect(IMPORT_TARGETS[0]).toMatchObject({ key: 'analysis', entityName: null });
  });
});

describe('importRowsToDataset', () => {
  it('rejects unknown targets', async () => {
    await expect(importRowsToDataset('bogus', [])).rejects.toThrow('Select a supported import destination.');
  });

  it('does nothing for analysis-only imports', async () => {
    const result = await importRowsToDataset('analysis', [{ a: 1 }]);
    expect(result).toMatchObject({ imported: 0, failed: 0, analysisOnly: true });
    expect(crmClient.entities.Contact.create).not.toHaveBeenCalled();
  });

  it('maps contact columns, splitting a full name when first/last are absent', async () => {
    const result = await importRowsToDataset('contacts', [
      { 'Full Name': 'Jane Quincy Doe', Email: 'j@x.com', Mobile: '555', Company: 'Acme' },
    ]);

    expect(result).toMatchObject({ imported: 1, failed: 0, errors: [] });
    expect(crmClient.entities.Contact.create).toHaveBeenCalledWith({
      first_name: 'Jane',
      last_name: 'Quincy Doe',
      email: 'j@x.com',
      phone: '555',
      company: 'Acme',
      status: 'active',
      source: 'Spreadsheet import',
    });
  });

  it('prefers explicit first/last name columns over splitting', async () => {
    await importRowsToDataset('contacts', [{ 'First Name': 'Al', 'Last Name': 'Bo', Name: 'Ignored Name' }]);
    const payload = crmClient.entities.Contact.create.mock.calls.at(-1)[0];
    expect(payload.first_name).toBe('Al');
    expect(payload.last_name).toBe('Bo');
  });

  it('cleans currency formatting when importing sales amounts', async () => {
    await importRowsToDataset('sales', [{ Product: 'Widget', Qty: '2', Total: '$1,234.50', Date: '2024-01-05' }]);
    const payload = crmClient.entities.Sale.create.mock.calls.at(-1)[0];
    expect(payload).toMatchObject({
      product_name: 'Widget',
      quantity: 2,
      total_amount: 1234.5,
      payment_status: 'paid',
      channel: 'imported',
      sale_date: '2024-01-05',
    });
  });

  it('generates a unique IMP- sku for products without one', async () => {
    await importRowsToDataset('products', [{ name: 'Bolt', stock: '7', 'reorder level': '2', price: '1.5' }]);
    const payload = crmClient.products.create.mock.calls.at(-1)[0];
    expect(payload.sku).toMatch(/^IMP-\d+-[a-z0-9]{1,5}$/);
    expect(payload).toMatchObject({
      name: 'Bolt',
      stock_quantity: 7,
      reorder_level: 2,
      unit_price: 1.5,
      cost_price: 0,
      category: 'General',
      status: 'active',
    });
  });

  it('collects per-row errors with a spreadsheet row number and keeps importing', async () => {
    crmClient.expenses.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Amount too large'))
      .mockRejectedValueOnce({});

    const result = await importRowsToDataset('expenses', [
      { title: 'A', amount: '1' },
      { title: 'B', amount: '999999' },
      { title: 'C', amount: '3' },
    ]);

    expect(result.imported).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual([
      { row: 3, message: 'Amount too large' },
      { row: 4, message: 'Import failed' },
    ]);
  });

  it.each([
    ['(500.00)', -500],
    ['($1,234.50)', -1234.5],
    ['500-', -500],
    ['-$1,234.50', -1234.5],
    ['$1,234.50', 1234.5],
    ['(0)', 0],
  ])('imports the amount "%s" as %s', async (input, expected) => {
    await importRowsToDataset('expenses', [{ title: 'Refund', amount: input }]);
    expect(crmClient.expenses.create.mock.calls.at(-1)[0].amount).toBe(expected);
  });

  it('skips blank spreadsheet rows without counting them as failures', async () => {
    const result = await importRowsToDataset('suppliers', [
      { name: 'Acme', email: '', phone: '' },
      { name: '', email: '  ', phone: '' },
      {},
    ]);

    expect(result).toMatchObject({ imported: 1, failed: 0, skipped: 2, errors: [] });
    expect(crmClient.suppliers.create).toHaveBeenCalledTimes(1);
  });

  it('reports rows with no identifying data instead of creating placeholder records', async () => {
    const result = await importRowsToDataset('contacts', [
      { Company: 'Acme', Phone: '555' },
      { Email: 'ok@x.com' },
    ]);

    expect(result).toMatchObject({ imported: 1, failed: 1 });
    expect(result.errors).toEqual([{ row: 2, message: 'Contact needs a name or email' }]);
    expect(crmClient.entities.Contact.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['expenses', { title: 'Lunch', amount: 'abc' }, 'Expense amount is not a number'],
    ['expenses', { title: 'Lunch' }, 'Expense needs an amount'],
    ['sales', { Qty: '2' }, 'Sale needs a product or a total amount'],
    ['sales', { Product: 'Widget', Total: 'TBD' }, 'Sale amount is not a number'],
    ['products', { stock: '3' }, 'Product needs a name or SKU'],
  ])('rejects invalid %s rows: %j', async (target, row, message) => {
    const result = await importRowsToDataset(target, [row]);
    expect(result).toMatchObject({ imported: 0, failed: 1 });
    expect(result.errors).toEqual([{ row: 2, message }]);
    const mock = crmClient[target === 'expenses' ? 'expenses' : target === 'sales' ? 'sales' : 'products'];
    const creator = target === 'sales' ? crmClient.entities.Sale.create : mock.create;
    expect(creator).not.toHaveBeenCalled();
  });
});
