import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialForm = {
  reference_type: 'manual',
  reference_id: '',
  customer_name: '',
  amount: 0,
  payment_date: new Date().toISOString().slice(0, 10),
  method: 'bank_transfer',
  status: 'received',
  notes: '',
};

export default function PaymentFormDialog({ open, onOpenChange, payment, orders, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(payment ? { ...initialForm, ...payment } : initialForm);
  }, [payment, open]);

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

  const handleReferenceChange = (value) => {
    const order = orders.find((item) => item.id === value);
    setForm((current) => ({
      ...current,
      reference_type: value ? 'sales_order' : 'manual',
      reference_id: value,
      customer_name: value ? (order?.customer_name || current.customer_name) : current.customer_name,
      amount: value ? (order?.balance_due || order?.total_amount || current.amount) : current.amount,
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payment ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ ...form, amount: Number(form.amount || 0) });
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor={fid('reference_id')}>Sales Order</Label>
            <Select value={form.reference_id || 'none'} onValueChange={(value) => handleReferenceChange(value === 'none' ? '' : value)}>
              <SelectTrigger {...fieldProps('reference_id')}><SelectValue placeholder="Select order" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Manual payment</SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.document_number} - {order.customer_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('customer_name')}>Customer Name *</Label>
              <Input {...fieldProps('customer_name')} aria-required="true" value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} onInvalid={flagInvalid('customer_name', 'Customer name is required.')} required />
              {errorFor('customer_name')}
            </div>
            <div>
              <Label htmlFor={fid('amount')}>Amount *</Label>
              <Input {...fieldProps('amount')} aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} onInvalid={flagInvalid('amount', 'Amount is required.')} required />
              {errorFor('amount')}
            </div>
            <div>
              <Label htmlFor={fid('payment_date')}>Payment Date</Label>
              <Input {...fieldProps('payment_date')} type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('method')}>Method</Label>
              <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value })}>
                <SelectTrigger {...fieldProps('method')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={fid('notes')}>Notes</Label>
              <Input {...fieldProps('notes')} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Reference, receipt note, or transfer details" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save Payment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
