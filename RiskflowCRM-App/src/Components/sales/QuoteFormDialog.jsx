import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  title: '',
  contact_id: '',
  customer_name: '',
  subtotal: 0,
  discount_amount: 0,
  tax_rate: 0,
  quote_date: new Date().toISOString().slice(0, 10),
  valid_until: new Date().toISOString().slice(0, 10),
  status: 'draft',
  notes: '',
};

export default function QuoteFormDialog({ open, onOpenChange, quote, contacts, defaultTaxRate = 0, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(
      quote
        ? { ...initialForm, ...quote }
        : { ...initialForm, tax_rate: defaultTaxRate }
    );
  }, [quote, open, defaultTaxRate]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.id === form.contact_id),
    [contacts, form.contact_id]
  );

  useEffect(() => {
    if (selectedContact && !quote) {
      setForm((current) => ({
        ...current,
        customer_name: `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim(),
      }));
    }
  }, [selectedContact, quote]);

  const total = Number(form.subtotal || 0) + (Number(form.subtotal || 0) * Number(form.tax_rate || 0)) / 100 - Number(form.discount_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{quote ? 'Edit Quote' : 'Create Quote'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              ...form,
              subtotal: Number(form.subtotal || 0),
              discount_amount: Number(form.discount_amount || 0),
              tax_rate: Number(form.tax_rate || 0),
              total_amount: total,
            });
          }}
          className="space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Quote Title *</Label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </div>
            <div>
              <Label>Customer</Label>
              <Select value={form.contact_id || 'none'} onValueChange={(value) => setForm({ ...form, contact_id: value === 'none' ? '' : value })}>
                <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Manual customer</SelectItem>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {`${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email || 'Unnamed'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} required />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quote Date</Label>
              <Input type="date" value={form.quote_date} onChange={(event) => setForm({ ...form, quote_date: event.target.value })} />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input type="date" value={form.valid_until} onChange={(event) => setForm({ ...form, valid_until: event.target.value })} />
            </div>
            <div>
              <Label>Subtotal</Label>
              <Input type="number" min="0" value={form.subtotal} onChange={(event) => setForm({ ...form, subtotal: event.target.value })} />
            </div>
            <div>
              <Label>Discount</Label>
              <Input type="number" min="0" value={form.discount_amount} onChange={(event) => setForm({ ...form, discount_amount: event.target.value })} />
            </div>
            <div>
              <Label>Tax Rate %</Label>
              <Input type="number" min="0" value={form.tax_rate} onChange={(event) => setForm({ ...form, tax_rate: event.target.value })} />
            </div>
            <div>
              <Label>Total</Label>
              <Input value={total} disabled />
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{quote ? 'Save Quote' : 'Create Quote'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
