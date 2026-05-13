import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function OrderFormDialog({ open, onOpenChange, order, defaultTaxRate = 0, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(order ? { ...initialForm, ...order } : { ...initialForm, tax_rate: defaultTaxRate });
  }, [order, open, defaultTaxRate]);

  const total = Number(form.subtotal || 0) + (Number(form.subtotal || 0) * Number(form.tax_rate || 0)) / 100 - Number(form.discount_amount || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{order ? 'Edit Sales Order' : 'Create Sales Order'}</DialogTitle>
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
              <Label>Order Title *</Label>
              <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </div>
            <div>
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} required />
            </div>
            <div>
              <Label>Order Date</Label>
              <Input type="date" value={form.order_date} onChange={(event) => setForm({ ...form, order_date: event.target.value })} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Button type="submit">{order ? 'Save Order' : 'Create Order'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
