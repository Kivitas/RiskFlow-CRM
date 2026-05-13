import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const money = (value, currencyInfo) => {
  const amount = Number(value || 0);
  const locale = currencyInfo?.locale || 'en-US';
  const code = currencyInfo?.code || 'USD';
  const decimals = Number.isInteger(currencyInfo?.decimals) ? currencyInfo.decimals : ['JPY', 'KRW'].includes(code) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

const sanitizeFilename = (value, fallback) =>
  String(value || fallback || 'document')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .toLowerCase();

const addBrandHeader = (doc, profile, title, documentNumber) => {
  doc.setFillColor(10, 26, 62);
  doc.rect(0, 0, 210, 36, 'F');

  if (profile.logoDataUrl) {
    try {
      doc.addImage(profile.logoDataUrl, 'PNG', 14, 8, 18, 18);
    } catch {
      try {
        doc.addImage(profile.logoDataUrl, 'JPEG', 14, 8, 18, 18);
      } catch {
        // ignore unsupported image formats
      }
    }
  } else {
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(14, 8, 18, 18, 4, 4, 'F');
    doc.setFontSize(15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('R', 23, 20, { align: 'center' });
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(20);
  doc.text(profile.companyName || 'RiskFlow Workspace', 38, 16);
  doc.setFontSize(10);
  doc.text(profile.companyEmail || 'workspace@local', 38, 23);
  if (profile.companyPhone) {
    doc.text(profile.companyPhone, 38, 29);
  }

  doc.setFontSize(22);
  doc.text(title, 196, 15, { align: 'right' });
  doc.setFontSize(10);
  doc.text(`No: ${documentNumber}`, 196, 22, { align: 'right' });
  doc.text(`Date: ${new Date().toISOString().slice(0, 10)}`, 196, 28, { align: 'right' });

  return 48;
};

const addBusinessMeta = (doc, profile, startY, currencyInfo) => {
  const leftLines = [
    profile.companyAddress,
    profile.companyWebsite,
  ].filter(Boolean);

  const rightLines = [
    profile.gstNumber ? `GST: ${profile.gstNumber}` : '',
    profile.vatNumber ? `VAT: ${profile.vatNumber}` : '',
    profile.panNumber ? `Tax ID: ${profile.panNumber}` : '',
    profile.registrationNumber ? `Reg No: ${profile.registrationNumber}` : '',
    currencyInfo?.code ? `Currency: ${currencyInfo.code}` : '',
  ].filter(Boolean);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  leftLines.forEach((line, index) => {
    doc.text(String(line), 14, startY + index * 5);
  });
  rightLines.forEach((line, index) => {
    doc.text(String(line), 196, startY + index * 5, { align: 'right' });
  });

  return startY + Math.max(leftLines.length, rightLines.length, 1) * 5 + 6;
};

const addBillToSection = (doc, { label, name, lines }, x, y, width) => {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(x, y, width, 26, 3, 3, 'FD');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(label, x + 4, y + 6);
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(name || '-', x + 4, y + 12);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  lines.filter(Boolean).slice(0, 2).forEach((line, index) => {
    doc.text(String(line), x + 4, y + 18 + index * 4.5);
  });
};

const addTotals = (doc, rows, x, startY) => {
  let y = startY;
  rows.forEach((row) => {
    doc.setFontSize(row.emphasis ? 11 : 10);
    doc.setTextColor(row.emphasis ? 15 : 71, row.emphasis ? 23 : 85, row.emphasis ? 42 : 105);
    doc.text(row.label, x, y);
    doc.text(row.value, 196, y, { align: 'right' });
    y += row.emphasis ? 7 : 6;
  });
  return y;
};

const addFooter = (doc, profile) => {
  const footerY = 266;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY - 6, 196, footerY - 6);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const bankLines = [
    profile.bankName ? `Bank: ${profile.bankName}` : '',
    profile.bankAccountName ? `A/C Name: ${profile.bankAccountName}` : '',
    profile.bankAccountNumber ? `A/C No: ${profile.bankAccountNumber}` : '',
    profile.bankIfsc ? `IFSC/Routing: ${profile.bankIfsc}` : '',
    profile.bankSwift ? `SWIFT: ${profile.bankSwift}` : '',
  ].filter(Boolean);

  bankLines.slice(0, 3).forEach((line, index) => {
    doc.text(line, 14, footerY + index * 4.5);
  });

  if (profile.invoiceFooterNote) {
    const wrapped = doc.splitTextToSize(profile.invoiceFooterNote, 88);
    doc.text(wrapped, 108, footerY);
  } else {
    doc.text('Thank you for your business.', 108, footerY);
  }
};

const baseDoc = ({ profile, title, documentNumber, currencyInfo }) => {
  const doc = new jsPDF();
  let y = addBrandHeader(doc, profile, title, documentNumber);
  y = addBusinessMeta(doc, profile, y, currencyInfo);
  return { doc, y };
};

const buildInvoice = ({
  profile,
  title,
  documentNumber,
  currencyInfo,
  customerName,
  customerLines,
  metaLines,
  items,
  totals,
  fileName,
}) => {
  const { doc, y } = baseDoc({ profile, title, documentNumber, currencyInfo });

  addBillToSection(doc, {
    label: 'Bill To',
    name: customerName,
    lines: customerLines,
  }, 14, y, 88);

  addBillToSection(doc, {
    label: 'Document Details',
    name: title,
    lines: metaLines,
  }, 108, y, 88);

  autoTable(doc, {
    startY: y + 34,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: items.map((item) => [
      item.description,
      item.quantity,
      item.unitPrice,
      item.amount,
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [51, 65, 85],
    },
    headStyles: {
      fillColor: [29, 78, 216],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      1: { halign: 'right', cellWidth: 22 },
      2: { halign: 'right', cellWidth: 32 },
      3: { halign: 'right', cellWidth: 32 },
    },
    margin: { left: 14, right: 14 },
  });

  const tableY = (doc.lastAutoTable?.finalY || y + 90) + 10;
  addTotals(doc, totals, 126, tableY);
  addFooter(doc, profile);
  doc.save(`${sanitizeFilename(fileName, documentNumber)}.pdf`);
};

export const generateDealInvoicePdf = ({ profile, deal, currencyInfo, convertAmount }) => {
  const convert = convertAmount || ((value) => value);
  const fmt = (value) => money(convert(value), currencyInfo);
  const total = Number(deal.value || 0);
  const subtotal = total / (1 + Number(profile.taxRate || 0) / 100 || 1);
  const taxAmount = total - subtotal;

  buildInvoice({
    profile,
    title: 'CRM Invoice',
    documentNumber: deal.document_number || `CRM-${String(deal.id || '').slice(0, 8).toUpperCase()}`,
    currencyInfo,
    customerName: deal.contact_name || 'Client',
    customerLines: [deal.stage ? `Stage: ${deal.stage}` : '', deal.expected_close_date ? `Close: ${deal.expected_close_date}` : ''],
    metaLines: [deal.title || 'CRM deal', deal.notes || ''],
    items: [
      {
        description: deal.title || 'CRM engagement',
        quantity: '1',
        unitPrice: fmt(subtotal),
        amount: fmt(subtotal),
      },
    ],
    totals: [
      { label: 'Subtotal', value: fmt(subtotal) },
      { label: `${profile.gstNumber ? 'GST' : profile.vatNumber ? 'VAT' : 'Tax'} (${Number(profile.taxRate || 0)}%)`, value: fmt(taxAmount) },
      { label: 'Grand Total', value: fmt(total), emphasis: true },
    ],
    fileName: deal.title || 'crm-invoice',
  });
};

export const generateSaleInvoicePdf = ({ profile, sale, currencyInfo, convertAmount }) => {
  const convert = convertAmount || ((value) => value);
  const fmt = (value) => money(convert(value), currencyInfo);
  const subtotal = Number(sale.subtotal || sale.total_amount || 0);
  const taxRate = Number(sale.tax_rate ?? profile.taxRate ?? 0);
  const taxAmount = Number(sale.tax_amount ?? ((subtotal * taxRate) / 100));
  const total = Number(sale.total_amount || subtotal + taxAmount);

  buildInvoice({
    profile,
    title: 'Sales Invoice',
    documentNumber: sale.invoice_number || `SALE-${String(sale.id || '').slice(0, 8).toUpperCase()}`,
    currencyInfo,
    customerName: sale.customer_name || 'Walk-in Customer',
    customerLines: [sale.sale_date ? `Sale Date: ${sale.sale_date}` : '', sale.channel ? `Channel: ${sale.channel}` : ''],
    metaLines: [sale.product_name || 'Product sale', sale.notes || ''],
    items: [
      {
        description: sale.product_name || 'Product',
        quantity: String(sale.quantity || 1),
        unitPrice: fmt(sale.unit_price),
        amount: fmt(subtotal),
      },
    ],
    totals: [
      { label: 'Subtotal', value: fmt(subtotal) },
      { label: `${profile.gstNumber ? 'GST' : profile.vatNumber ? 'VAT' : 'Tax'} (${taxRate}%)`, value: fmt(taxAmount) },
      { label: 'Grand Total', value: fmt(total), emphasis: true },
    ],
    fileName: sale.product_name || 'sales-invoice',
  });
};

export const generateQuotePdf = ({ profile, quote, currencyInfo, convertAmount }) => {
  const convert = convertAmount || ((value) => value);
  const fmt = (value) => money(convert(value), currencyInfo);

  buildInvoice({
    profile,
    title: 'Quote',
    documentNumber: quote.document_number || `QT-${String(quote.id || '').slice(0, 8).toUpperCase()}`,
    currencyInfo,
    customerName: quote.customer_name || 'Customer',
    customerLines: [quote.quote_date ? `Quote Date: ${quote.quote_date}` : '', quote.valid_until ? `Valid Until: ${quote.valid_until}` : ''],
    metaLines: [quote.title || 'Quote', quote.notes || ''],
    items: [
      {
        description: quote.title || 'Quoted services',
        quantity: '1',
        unitPrice: fmt(quote.subtotal),
        amount: fmt(quote.subtotal),
      },
    ],
    totals: [
      { label: 'Subtotal', value: fmt(quote.subtotal) },
      { label: `${profile.gstNumber ? 'GST' : profile.vatNumber ? 'VAT' : 'Tax'} (${Number(quote.tax_rate || profile.taxRate || 0)}%)`, value: fmt(quote.tax_amount) },
      { label: 'Discount', value: fmt(quote.discount_amount || 0) },
      { label: 'Grand Total', value: fmt(quote.total_amount), emphasis: true },
    ],
    fileName: quote.document_number || 'quote',
  });
};

export const generateSalesOrderInvoicePdf = ({ profile, order, currencyInfo, convertAmount }) => {
  const convert = convertAmount || ((value) => value);
  const fmt = (value) => money(convert(value), currencyInfo);

  buildInvoice({
    profile,
    title: 'Sales Order',
    documentNumber: order.document_number || `SO-${String(order.id || '').slice(0, 8).toUpperCase()}`,
    currencyInfo,
    customerName: order.customer_name || 'Customer',
    customerLines: [order.order_date ? `Order Date: ${order.order_date}` : '', order.status ? `Status: ${order.status}` : ''],
    metaLines: [order.title || 'Sales order', order.notes || ''],
    items: [
      {
        description: order.title || 'Sales order',
        quantity: '1',
        unitPrice: fmt(order.subtotal),
        amount: fmt(order.subtotal),
      },
    ],
    totals: [
      { label: 'Subtotal', value: fmt(order.subtotal) },
      { label: `${profile.gstNumber ? 'GST' : profile.vatNumber ? 'VAT' : 'Tax'} (${Number(order.tax_rate || profile.taxRate || 0)}%)`, value: fmt(order.tax_amount) },
      { label: 'Discount', value: fmt(order.discount_amount || 0) },
      { label: 'Grand Total', value: fmt(order.total_amount), emphasis: true },
    ],
    fileName: order.document_number || 'sales-order',
  });
};
