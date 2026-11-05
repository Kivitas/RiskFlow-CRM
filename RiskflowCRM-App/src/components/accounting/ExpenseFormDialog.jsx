import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  title: '',
  vendor_name: '',
  amount: 0,
  category: 'operations',
  expense_date: new Date().toISOString().slice(0, 10),
  payment_status: 'paid',
  notes: '',
};

export default function ExpenseFormDialog({ open, onOpenChange, expense, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(expense ? { ...initialForm, ...expense } : initialForm);
  }, [expense, open]);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      amount: Number(form.amount || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('title')}>Expense Title *</Label>
              <Input {...fieldProps('title')} aria-required="true" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} onInvalid={flagInvalid('title', 'Expense title is required.')} required />
              {errorFor('title')}
            </div>
            <div>
              <Label htmlFor={fid('vendor_name')}>Vendor</Label>
              <Input {...fieldProps('vendor_name')} value={form.vendor_name} onChange={(event) => setForm({ ...form, vendor_name: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('amount')}>Amount *</Label>
              <Input {...fieldProps('amount')} aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} onInvalid={flagInvalid('amount', 'Amount is required.')} required />
              {errorFor('amount')}
            </div>
            <div>
              <Label htmlFor={fid('expense_date')}>Expense Date</Label>
              <Input {...fieldProps('expense_date')} type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('category')}>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger {...fieldProps('category')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="payroll">Payroll</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="rent">Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('payment_status')}>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger {...fieldProps('payment_status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor={fid('notes')}>Notes</Label>
            <Textarea {...fieldProps('notes')} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : expense ? 'Update Expense' : 'Create Expense'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
