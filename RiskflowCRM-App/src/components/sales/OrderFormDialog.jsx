import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  title: '',
  customer_name: '',
  subtotal: 0,
  discount_amount: 0,
  tax_rate: 0,
  order_date: new Date().toISOString().slice(0, 10),
  due_date: new Date().toISOString().slice(0, 10),
  status: 'draft',
  notes: '',
};

export default function OrderFormDialog({ open, onOpenChange, order, defaultTaxRate = 0, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(order ? { ...initialForm, ...order } : { ...initialForm, tax_rate: defaultTaxRate });
  }, [order, open, defaultTaxRate]);

  useEffect(() => {
    setErrors({});
  }, [form]);

  const flagInvalid = (name, missing) => (event) => {
    event.preventDefault();
    const message = event.target.validity.valueMissing ? missing : event.target.validationMessage;
    setErrors((prev) => ({ ...prev, [name]: message }));
  };
  const fieldProps = (name) => ({
    id: fid(name),
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? fid(`${name}-error`) : undefined,
  });
  const errorFor = (name) => <FieldError id={fid(`${name}-error`)}>{errors[name]}</FieldError>;

  const total = Number(form.subtotal || 0) + (Number(form.subtotal || 0) * Number(form.tax_rate || 0)) / 100 - Number(form.discount_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Edit Sales Order' : 'Create Sales Order'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
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
              <Label htmlFor={fid('title')}>Order Title *</Label>
              <Input {...fieldProps('title')} aria-required="true" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onInvalid={flagInvalid('title', 'Order title is required.')} required />
              {errorFor('title')}
            </div>
            <div>
              <Label htmlFor={fid('customer_name')}>Customer Name *</Label>
              <Input {...fieldProps('customer_name')} aria-required="true" value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} onInvalid={flagInvalid('customer_name', 'Customer name is required.')} required />
              {errorFor('customer_name')}
            </div>
            <div>
              <Label htmlFor={fid('order_date')}>Order Date</Label>
              <Input {...fieldProps('order_date')} type="date" value={form.order_date} onChange={(event) => setForm({ ...form, order_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('due_date')}>Due Date</Label>
              <Input {...fieldProps('due_date')} type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('status')}>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger {...fieldProps('status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="invoiced">Invoiced</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('subtotal')}>Subtotal</Label>
              <Input {...fieldProps('subtotal')} type="number" min="0" step="0.01" inputMode="decimal" value={form.subtotal} onChange={(event) => setForm({ ...form, subtotal: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('discount_amount')}>Discount</Label>
              <Input {...fieldProps('discount_amount')} type="number" min="0" step="0.01" inputMode="decimal" value={form.discount_amount} onChange={(event) => setForm({ ...form, discount_amount: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('tax_rate')}>Tax Rate %</Label>
              <Input {...fieldProps('tax_rate')} type="number" min="0" step="0.01" inputMode="decimal" value={form.tax_rate} onChange={(event) => setForm({ ...form, tax_rate: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('total')}>Total</Label>
              <Input id={fid('total')} value={total} disabled />
            </div>
          </div>
          <div>
            <Label htmlFor={fid('notes')}>Notes</Label>
            <Textarea {...fieldProps('notes')} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : order ? 'Save Order' : 'Create Order'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
