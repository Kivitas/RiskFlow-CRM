import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function PaymentFormDialog({ open, onOpenChange, payment, orders, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(payment ? { ...initialForm, ...payment } : initialForm);
  }, [payment, open]);

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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{payment ? 'Edit Payment' : 'Record Payment'}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ ...form, amount: Number(form.amount || 0) });
          }}
          className="space-y-4"
        >
          <div>
            <Label>Sales Order</Label>
            <Select value={form.reference_id || 'none'} onValueChange={(value) => handleReferenceChange(value === 'none' ? '' : value)}>
              <SelectTrigger><SelectValue placeholder="Select order" /></SelectTrigger>
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
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} required />
            </div>
            <div>
              <Label>Amount *</Label>
              <Input type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required />
            </div>
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={form.payment_date} onChange={(event) => setForm({ ...form, payment_date: event.target.value })} />
            </div>
            <div>
              <Label>Method</Label>
              <Select value={form.method} onValueChange={(value) => setForm({ ...form, method: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Reference, receipt note, or transfer details" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save Payment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
