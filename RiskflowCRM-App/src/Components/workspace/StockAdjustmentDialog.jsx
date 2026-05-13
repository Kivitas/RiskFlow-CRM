import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  product_id: '',
  quantity: 0,
  reason: 'count_correction',
  notes: '',
  adjustment_date: new Date().toISOString().slice(0, 10),
};

export default function StockAdjustmentDialog({ open, onOpenChange, products, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({ ...form, quantity: Number(form.quantity || 0) });
          }}
          className="space-y-4"
        >
          <div>
            <Label>Product *</Label>
            <Select value={form.product_id} onValueChange={(value) => setForm({ ...form, product_id: value })}>
              <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.stock_quantity} in stock)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Quantity Change *</Label>
              <Input type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.adjustment_date} onChange={(event) => setForm({ ...form, adjustment_date: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Reason</Label>
              <Select value={form.reason} onValueChange={(value) => setForm({ ...form, reason: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count_correction">Count Correction</SelectItem>
                  <SelectItem value="damage">Damage / Loss</SelectItem>
                  <SelectItem value="return">Customer Return</SelectItem>
                  <SelectItem value="manual_restock">Manual Restock</SelectItem>
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
            <Button type="submit" disabled={!form.product_id}>Apply Adjustment</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
