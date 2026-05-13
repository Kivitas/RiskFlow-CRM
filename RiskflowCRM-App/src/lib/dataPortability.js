import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { crmClient } from '@/api/crmClient';

const buildReportRows = async () => {
  const [contacts, deals, risks, products, sales, purchases, expenses, quotes, orders, payments, approvals] = await Promise.all([
    crmClient.entities.Contact.list(),
    crmClient.entities.Deal.list(),
    crmClient.entities.RiskAssessment.list(),
    crmClient.products.list(),
    crmClient.sales.list('-sale_date'),
    crmClient.purchases.list('-order_date'),
    crmClient.expenses.list('-expense_date'),
    crmClient.quotes.list('-quote_date'),
    crmClient.salesOrders.list('-order_date'),
    crmClient.payments.list('-payment_date'),
    crmClient.approvals.list('-created_date'),
  ]);
  const completedSales = sales.filter((sale) => sale.payment_status !== 'refunded');
  const report = [
    { section: 'CRM', metric: 'Contacts', value: contacts.length },
    { section: 'CRM', metric: 'Open Deals', value: deals.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage)).length },
    { section: 'CRM', metric: 'Pipeline Value', value: deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0) },
    { section: 'Risk', metric: 'High/Critical Risks', value: risks.filter((risk) => ['high', 'critical'].includes(risk.severity)).length },
    { section: 'Inventory', metric: 'Products', value: products.length },
    { section: 'Inventory', metric: 'Low Stock Items', value: products.filter((product) => product.status === 'active' && Number(product.stock_quantity || 0) <= Number(product.reorder_level || 0)).length },
    { section: 'Inventory', metric: 'Inventory Value', value: products.reduce((sum, product) => sum + Number(product.inventory_value || 0), 0) },
    { section: 'Sales', metric: 'Sales Revenue', value: completedSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0) },
    { section: 'Sales', metric: 'Sales Orders', value: orders.length },
    { section: 'Sales', metric: 'Quotes Value', value: quotes.reduce((sum, quote) => sum + Number(quote.total_amount || 0), 0) },
    { section: 'Procurement', metric: 'Purchase Orders', value: purchases.length },
    { section: 'Finance', metric: 'Expenses', value: expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0) },
    { section: 'Finance', metric: 'Payments Collected', value: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) },
    { section: 'Approvals', metric: 'Open Approvals', value: approvals.filter((approval) => approval.status === 'pending').length },
  ];
  return report;
};

export const DATASETS = [
  { key: 'reports', label: 'Reports Summary', fetcher: buildReportRows },
  { key: 'contacts', label: 'Contacts', fetcher: () => crmClient.entities.Contact.list() },
  { key: 'deals', label: 'Deals', fetcher: () => crmClient.entities.Deal.list() },
  { key: 'risks', label: 'Risk Assessments', fetcher: () => crmClient.entities.RiskAssessment.list() },
  { key: 'products', label: 'Products', fetcher: () => crmClient.products.list() },
  { key: 'sales', label: 'Sales', fetcher: () => crmClient.sales.list('-sale_date') },
  { key: 'suppliers', label: 'Suppliers', fetcher: () => crmClient.suppliers.list() },
  { key: 'purchaseOrders', label: 'Purchase Orders', fetcher: () => crmClient.purchases.list('-order_date') },
  { key: 'expenses', label: 'Expenses', fetcher: () => crmClient.expenses.list('-expense_date') },
  { key: 'quotes', label: 'Quotes', fetcher: () => crmClient.quotes.list('-quote_date') },
  { key: 'salesOrders', label: 'Sales Orders', fetcher: () => crmClient.salesOrders.list('-order_date') },
  { key: 'payments', label: 'Payments', fetcher: () => crmClient.payments.list('-payment_date') },
  { key: 'users', label: 'Users', fetcher: () => crmClient.users.list() },
  { key: 'approvals', label: 'Approvals', fetcher: () => crmClient.approvals.list('-created_date') },
  { key: 'audit', label: 'Audit Log', fetcher: () => crmClient.audit.list('-created_date') },
];

export const IMPORT_TARGETS = [
  { key: 'analysis', label: 'Analyze Only / External Report', entityName: null },
  { key: 'contacts', label: 'Contacts', entityName: 'Contact' },
  { key: 'deals', label: 'Deals', entityName: 'Deal' },
  { key: 'products', label: 'Products', entityName: 'Product' },
  { key: 'sales', label: 'Sales', entityName: 'Sale' },
  { key: 'suppliers', label: 'Suppliers', entityName: 'Supplier' },
  { key: 'expenses', label: 'Expenses', entityName: 'Expense' },
  { key: 'quotes', label: 'Quotes', entityName: 'Quote' },
];

const sanitizeValue = (value) => {
  if (value == null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)).join('; ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
};

export const normalizeRows = (rows) =>
  rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, sanitizeValue(value)]))
  );

const csvEscape = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  const headers = (rows.shift() || []).map((header) => String(header || '').trim());
  return rows
    .filter((cells) => cells.some((value) => String(value || '').trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header || `Column ${index + 1}`, cells[index] ?? ''])));
};

const parseOds = (buffer) => {
  const files = unzipSync(new Uint8Array(buffer));
  const content = files['content.xml'];
  if (!content) {
    throw new Error('Invalid ODS file: content.xml missing.');
  }
  const xml = strFromU8(content);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const rows = Array.from(doc.getElementsByTagName('table:table-row'));
  const matrix = rows.map((row) => {
    const cells = [];
    Array.from(row.children).forEach((cell) => {
      if (!cell.tagName.endsWith('table-cell')) {
        return;
      }
      const repeat = Math.min(Number(cell.getAttribute('table:number-columns-repeated') || 1), 100);
      const text = Array.from(cell.getElementsByTagName('text:p')).map((node) => node.textContent || '').join('\n');
      for (let index = 0; index < repeat; index += 1) {
        cells.push(text);
      }
    });
    return cells;
  }).filter((row) => row.some((value) => String(value || '').trim()));

  const headers = (matrix.shift() || []).map((header, index) => String(header || `Column ${index + 1}`).trim());
  return matrix.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const safeNumber = (value, fallback = 0) => {
  const normalized = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(normalized) ? normalized : fallback;
};

const pick = (row, keys, fallback = '') => {
  const entries = Object.entries(row);
  const wanted = keys.map((key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, ''));
  const match = entries.find(([key]) => wanted.includes(String(key).toLowerCase().replace(/[^a-z0-9]/g, '')));
  return match ? match[1] : fallback;
};

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: parts[0] || 'Imported',
    last_name: parts.slice(1).join(' '),
  };
};

const buildImportPayload = (targetKey, row) => {
  if (targetKey === 'contacts') {
    const nameParts = splitName(pick(row, ['name', 'full name', 'contact name']));
    return {
      first_name: pick(row, ['first_name', 'first name'], nameParts.first_name),
      last_name: pick(row, ['last_name', 'last name'], nameParts.last_name),
      email: pick(row, ['email', 'email address']),
      phone: pick(row, ['phone', 'mobile', 'telephone']),
      company: pick(row, ['company', 'company name', 'organization']),
      status: pick(row, ['status'], 'active') || 'active',
      source: pick(row, ['source'], 'Spreadsheet import') || 'Spreadsheet import',
    };
  }

  if (targetKey === 'products') {
    const name = pick(row, ['name', 'product', 'product name', 'item']);
    return {
      name: name || 'Imported product',
      sku: pick(row, ['sku', 'code', 'item code']) || `IMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: pick(row, ['category'], 'General') || 'General',
      stock_quantity: safeNumber(pick(row, ['stock_quantity', 'stock', 'quantity', 'qty'])),
      reorder_level: safeNumber(pick(row, ['reorder_level', 'reorder level', 'minimum stock'])),
      unit_price: safeNumber(pick(row, ['unit_price', 'unit price', 'price', 'selling price'])),
      cost_price: safeNumber(pick(row, ['cost_price', 'cost price', 'cost'])),
      status: pick(row, ['status'], 'active') || 'active',
    };
  }

  if (targetKey === 'deals') {
    return {
      title: pick(row, ['title', 'deal', 'opportunity', 'name']) || 'Imported deal',
      contact_name: pick(row, ['contact', 'contact name', 'customer']),
      company: pick(row, ['company', 'account', 'organization']),
      stage: pick(row, ['stage', 'status'], 'discovery') || 'discovery',
      value: safeNumber(pick(row, ['value', 'amount', 'deal value'])),
      expected_close_date: pick(row, ['expected close', 'close date', 'expected_close_date']),
      notes: pick(row, ['notes', 'description']),
    };
  }

  if (targetKey === 'sales') {
    return {
      product_name: pick(row, ['product', 'product name', 'item']) || 'Imported sale',
      customer_name: pick(row, ['customer', 'customer name', 'client']),
      customer_email: pick(row, ['email', 'customer email']),
      customer_phone: pick(row, ['phone', 'customer phone', 'whatsapp']),
      quantity: safeNumber(pick(row, ['quantity', 'qty']), 1),
      unit_price: safeNumber(pick(row, ['unit price', 'unit_price', 'price'])),
      total_amount: safeNumber(pick(row, ['total', 'amount', 'total amount'])),
      payment_status: pick(row, ['payment status', 'payment_status', 'status'], 'paid') || 'paid',
      channel: pick(row, ['channel'], 'imported') || 'imported',
      sale_date: pick(row, ['date', 'sale date', 'sale_date']) || new Date().toISOString().slice(0, 10),
    };
  }

  if (targetKey === 'suppliers') {
    return {
      name: pick(row, ['name', 'supplier', 'supplier name', 'company']) || 'Imported supplier',
      email: pick(row, ['email', 'email address']),
      phone: pick(row, ['phone', 'mobile', 'telephone']),
      category: pick(row, ['category'], 'General') || 'General',
      status: pick(row, ['status'], 'active') || 'active',
      payment_terms: pick(row, ['payment_terms', 'payment terms'], 'Net 30') || 'Net 30',
    };
  }

  if (targetKey === 'expenses') {
    return {
      title: pick(row, ['title', 'name', 'description', 'expense']) || 'Imported expense',
      amount: safeNumber(pick(row, ['amount', 'total', 'value'])),
      category: pick(row, ['category'], 'General') || 'General',
      expense_date: pick(row, ['expense_date', 'date', 'expense date']) || new Date().toISOString().slice(0, 10),
      payment_status: pick(row, ['payment_status', 'payment status', 'status'], 'paid') || 'paid',
      notes: pick(row, ['notes', 'memo', 'description']),
    };
  }

  if (targetKey === 'quotes') {
    return {
      title: pick(row, ['title', 'quote', 'description']) || 'Imported quote',
      customer_name: pick(row, ['customer', 'customer name', 'client']),
      subtotal: safeNumber(pick(row, ['subtotal', 'amount'])),
      tax_rate: safeNumber(pick(row, ['tax rate', 'tax_rate'])),
      tax_amount: safeNumber(pick(row, ['tax', 'tax amount', 'tax_amount'])),
      discount_amount: safeNumber(pick(row, ['discount', 'discount amount', 'discount_amount'])),
      total_amount: safeNumber(pick(row, ['total', 'total amount'])),
      quote_date: pick(row, ['date', 'quote date', 'quote_date']) || new Date().toISOString().slice(0, 10),
      valid_until: pick(row, ['valid until', 'valid_until']),
      notes: pick(row, ['notes', 'memo']),
    };
  }

  return row;
};

export const exportRowsToCsv = (rows, label) => {
  const normalized = normalizeRows(rows);
  const columns = normalized.length ? Object.keys(normalized[0]) : [];
  const csv = [
    columns.map(csvEscape).join(','),
    ...normalized.map((row) => columns.map((column) => csvEscape(row[column])).join(',')),
  ].join('\r\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${label}.csv`);
};

export const exportRowsToOds = (rows, label) => {
  const normalized = normalizeRows(rows);
  const columns = normalized.length ? Object.keys(normalized[0]) : ['No data'];
  const tableRows = [
    columns,
    ...normalized.map((row) => columns.map((column) => row[column] ?? '')),
  ].map((row) => `
    <table:table-row>
      ${row.map((cell) => `<table:table-cell office:value-type="string"><text:p>${xmlEscape(cell)}</text:p></table:table-cell>`).join('')}
    </table:table-row>`).join('');

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2">
  <office:body><office:spreadsheet><table:table table:name="Data">${tableRows}</table:table></office:spreadsheet></office:body>
</office:document-content>`;
  const manifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
</manifest:manifest>`;
  const zipped = zipSync({
    mimetype: strToU8('application/vnd.oasis.opendocument.spreadsheet'),
    'content.xml': strToU8(contentXml),
    'META-INF/manifest.xml': strToU8(manifestXml),
  }, { level: 0 });
  downloadBlob(new Blob([zipped], { type: 'application/vnd.oasis.opendocument.spreadsheet' }), `${label}.ods`);
};

export const exportRowsToPdf = ({ rows, label, title, subtitle }) => {
  const normalized = normalizeRows(rows);
  const columns = normalized.length ? Object.keys(normalized[0]) : ['No data'];
  const body = normalized.length
    ? normalized.map((row) => columns.map((column) => String(row[column] ?? '')))
    : [['No records available']];

  const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(18);
  doc.text(title || label, 14, 18);
  if (subtitle) {
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 25);
  }

  autoTable(doc, {
    startY: subtitle ? 32 : 24,
    head: [columns],
    body,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [37, 99, 235],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  doc.save(`${label}.pdf`);
};

export const parseSpreadsheetFile = async (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'csv') {
    const rows = parseCsv(await file.text());
    return {
      workbook: null,
      sheetName: file.name,
      rows,
      columns: rows.length ? Object.keys(rows[0]) : [],
    };
  }

  if (extension === 'ods') {
    const rows = parseOds(await file.arrayBuffer());
    return {
      workbook: null,
      sheetName: file.name,
      rows,
      columns: rows.length ? Object.keys(rows[0]) : [],
    };
  }

  if (['xls', `xls${'x'}`].includes(extension)) {
    throw new Error('Excel workbook files are not imported directly. Save/export the sheet as .ods or .csv and try again.');
  }

  throw new Error('Unsupported file type. Use .ods or .csv.');
};

export const importRowsToDataset = async (targetKey, rows) => {
  const target = IMPORT_TARGETS.find((item) => item.key === targetKey);
  if (!target) {
    throw new Error('Select a supported import destination.');
  }
  if (targetKey === 'analysis') {
    return { imported: 0, failed: 0, errors: [], target, analysisOnly: true };
  }

  let imported = 0;
  const errors = [];
  for (const [index, row] of rows.entries()) {
    try {
      const payload = buildImportPayload(targetKey, row);
      if (targetKey === 'contacts') {
        await crmClient.entities.Contact.create(payload);
      } else if (targetKey === 'deals') {
        await crmClient.entities.Deal.create(payload);
      } else if (targetKey === 'products') {
        await crmClient.products.create(payload);
      } else if (targetKey === 'sales') {
        await crmClient.entities.Sale.create(payload);
      } else if (targetKey === 'suppliers') {
        await crmClient.suppliers.create(payload);
      } else if (targetKey === 'expenses') {
        await crmClient.expenses.create(payload);
      } else if (targetKey === 'quotes') {
        await crmClient.quotes.create(payload);
      }
      imported += 1;
    } catch (error) {
      errors.push({ row: index + 2, message: error.message || 'Import failed' });
    }
  }

  return { imported, failed: errors.length, errors, target };
};

export const getDatasetByKey = (key) => DATASETS.find((dataset) => dataset.key === key) || DATASETS[0];
