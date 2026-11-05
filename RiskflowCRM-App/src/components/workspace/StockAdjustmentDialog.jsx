import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  product_id: '',
  quantity: 0,
  reason: 'count_correction',
  notes: '',
  adjustment_date: new Date().toISOString().slice(0, 10),
};

export default function StockAdjustmentDialog({ open, onOpenChange, products, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(initialForm);
    }
  }, [open]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const quantity = Number(form.quantity || 0);
            if (!quantity) {
              setErrors((prev) => ({ ...prev, quantity: 'Enter a non-zero quantity change.' }));
              return;
            }
            onSave({ ...form, quantity });
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor={fid('product_id')}>Product *</Label>
            <Select value={form.product_id} onValueChange={(value) => setForm({ ...form, product_id: value })}>
              <SelectTrigger {...fieldProps('product_id')} aria-required="true"><SelectValue placeholder="Select product" /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} ({product.stock_quantity} in stock)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.product_id && (
              <p className="mt-1 text-xs text-muted-foreground">Select a product to adjust its stock.</p>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('quantity')}>Quantity Change *</Label>
              <Input {...fieldProps('quantity')} aria-required="true" type="number" step="1" inputMode="numeric" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} onInvalid={flagInvalid('quantity', 'Quantity change is required.')} required />
              {errorFor('quantity')}
            </div>
            <div>
              <Label htmlFor={fid('adjustment_date')}>Date</Label>
              <Input {...fieldProps('adjustment_date')} type="date" value={form.adjustment_date} onChange={(event) => setForm({ ...form, adjustment_date: event.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor={fid('reason')}>Reason</Label>
              <Select value={form.reason} onValueChange={(value) => setForm({ ...form, reason: value })}>
                <SelectTrigger {...fieldProps('reason')}><SelectValue /></SelectTrigger>
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
            <Label htmlFor={fid('notes')}>Notes</Label>
            <Textarea {...fieldProps('notes')} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !form.product_id}>{isSaving ? 'Saving…' : 'Apply Adjustment'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
