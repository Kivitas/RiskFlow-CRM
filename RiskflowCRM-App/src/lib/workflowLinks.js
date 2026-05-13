const cleanPhone = (value) => String(value || '').replace(/[^\d]/g, '');

export const openEmailWorkflow = ({ to = '', subject = '', body = '' }) => {
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const openWhatsAppWorkflow = ({ phone = '', message = '' }) => {
  const number = cleanPhone(phone);
  const url = number
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

export const buildInvoiceMessage = ({ profile, sale, total }) => [
  `Hello ${sale.customer_name || 'Customer'},`,
  '',
  `Your invoice from ${profile.companyName || 'RiskFlow CRM'} is ready.`,
  `Invoice: ${sale.invoice_number || sale.id || 'Sales invoice'}`,
  `Amount: ${total}`,
  '',
  'Please reply if you need any changes or payment details.',
].join('\n');

export const buildReportMessage = ({ profile, reportName, summary }) => [
  `Hello,`,
  '',
  `${reportName} from ${profile.companyName || 'RiskFlow CRM'} is ready.`,
  '',
  summary,
  '',
  'Open RiskFlow CRM to download the full PDF/ODS/CSV export.',
].join('\n');
