import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  openEmailWorkflow,
  openWhatsAppWorkflow,
  buildInvoiceMessage,
  buildReportMessage,
} from './workflowLinks';

let openSpy;

beforeEach(() => {
  openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('openEmailWorkflow', () => {
  it('builds a mailto URL with encoded subject and body and opens it safely', () => {
    openEmailWorkflow({ to: 'jane@example.com', subject: 'Invoice #1 & more', body: 'Line 1\nLine 2 = 100%' });

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target, features] = openSpy.mock.calls[0];
    expect(url).toBe(
      'mailto:jane%40example.com?subject=Invoice%20%231%20%26%20more&body=Line%201%0ALine%202%20%3D%20100%25'
    );
    expect(target).toBe('_blank');
    expect(features).toBe('noopener,noreferrer');
  });

  it('keeps the subject and body separated when they contain ? or &', () => {
    openEmailWorkflow({ to: 'a@b.co', subject: 'a?b', body: 'c&d' });
    const url = openSpy.mock.calls[0][0];
    const query = url.split('?')[1];
    const params = new URLSearchParams(query);
    expect(params.get('subject')).toBe('a?b');
    expect(params.get('body')).toBe('c&d');
  });

  it('defaults every field to an empty string', () => {
    openEmailWorkflow({});
    expect(openSpy.mock.calls[0][0]).toBe('mailto:?subject=&body=');
  });
});

describe('openWhatsAppWorkflow', () => {
  it('strips formatting characters from the phone number and encodes the message', () => {
    openWhatsAppWorkflow({ phone: '+1 (555) 123-4567', message: 'Hi there & welcome!' });

    expect(openSpy.mock.calls[0][0]).toBe('https://wa.me/15551234567?text=Hi%20there%20%26%20welcome!');
    expect(openSpy.mock.calls[0][1]).toBe('_blank');
    expect(openSpy.mock.calls[0][2]).toBe('noopener,noreferrer');
  });

  it('falls back to the share link without a number when the phone has no digits', () => {
    openWhatsAppWorkflow({ phone: 'n/a', message: 'Hello' });
    expect(openSpy.mock.calls[0][0]).toBe('https://wa.me/?text=Hello');
  });

  it('opens the share link with an empty text when no arguments are given', () => {
    openWhatsAppWorkflow({});
    expect(openSpy.mock.calls[0][0]).toBe('https://wa.me/?text=');
  });

  it('encodes emoji and newlines in the message', () => {
    openWhatsAppWorkflow({ phone: '44 7700', message: 'Line\nNext' });
    const url = openSpy.mock.calls[0][0];
    expect(url).toBe('https://wa.me/447700?text=Line%0ANext');
    expect(new URL(url).searchParams.get('text')).toBe('Line\nNext');
  });
});

describe('buildInvoiceMessage', () => {
  it('builds a greeting with the customer, company, invoice number and total', () => {
    const message = buildInvoiceMessage({
      profile: { companyName: 'Acme Ltd' },
      sale: { customer_name: 'Bob', invoice_number: 'INV-042' },
      total: '$1,250.00',
    });

    expect(message).toBe(
      [
        'Hello Bob,',
        '',
        'Your invoice from Acme Ltd is ready.',
        'Invoice: INV-042',
        'Amount: $1,250.00',
        '',
        'Please reply if you need any changes or payment details.',
      ].join('\n')
    );
  });

  it('falls back to defaults for missing customer, company, and invoice number', () => {
    const message = buildInvoiceMessage({ profile: {}, sale: { id: 'sale-9' }, total: '10' });
    expect(message).toContain('Hello Customer,');
    expect(message).toContain('Your invoice from RiskFlow CRM is ready.');
    expect(message).toContain('Invoice: sale-9');
  });

  it('uses a generic invoice label when there is neither an invoice number nor an id', () => {
    const message = buildInvoiceMessage({ profile: {}, sale: {}, total: '0' });
    expect(message).toContain('Invoice: Sales invoice');
  });
});

describe('buildReportMessage', () => {
  it('builds a report email body with the report name and summary', () => {
    const message = buildReportMessage({
      profile: { companyName: 'Acme' },
      reportName: 'Monthly Sales',
      summary: 'Revenue up 5%.',
    });

    expect(message).toBe(
      [
        'Hello,',
        '',
        'Monthly Sales from Acme is ready.',
        '',
        'Revenue up 5%.',
        '',
        'Open RiskFlow CRM to download the full PDF/ODS/CSV export.',
      ].join('\n')
    );
  });

  it('defaults the company name when the profile has none', () => {
    const message = buildReportMessage({ profile: {}, reportName: 'Risk', summary: 's' });
    expect(message).toContain('Risk from RiskFlow CRM is ready.');
  });
});
