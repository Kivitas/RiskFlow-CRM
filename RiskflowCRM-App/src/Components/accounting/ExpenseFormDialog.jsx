import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function ExpenseFormDialog({ open, onOpenChange, expense, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(expense ? { ...initialForm, ...expense } : initialForm);
  }, [expense, open]);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      amount: Number(form.amount || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Expense Title *</Label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </div>
            <div>
              <Label>Vendor</Label>
              <Input value={form.vendor_name} onChange={(event) => setForm({ ...form, vendor_name: event.target.value })} />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
            </div>
            <div>
              <Label>Expense Date</Label>
              <Input type="date" value={form.expense_date} onChange={(event) => setForm({ ...form, expense_date: event.target.value })} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{expense ? 'Update Expense' : 'Create Expense'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
