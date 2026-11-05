import React, { useEffect, useId, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  product_id: '',
  quantity: 1,
  unit_price: 0,
  customer_name: '',
  customer_email: '',
  customer_phone: '',
  sale_date: new Date().toISOString().slice(0, 10),
  payment_status: 'paid',
  channel: 'direct',
  notes: '',
};

export default function SaleFormDialog({ open, onOpenChange, sale, products, onSave, initialProductId = '', isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const nextForm = sale ? { ...initialForm, ...sale } : { ...initialForm, product_id: initialProductId };
    setForm(nextForm);
  }, [sale, open, initialProductId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === form.product_id),
    [form.product_id, products]
  );

  useEffect(() => {
    if (!sale && selectedProduct) {
      setForm((current) => ({ ...current, unit_price: selectedProduct.unit_price || 0 }));
    }
  }, [selectedProduct, sale]);

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

  const exceedsStock =
    !sale && Boolean(selectedProduct) && Number(form.quantity || 0) > Number(selectedProduct.stock_quantity || 0);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      quantity: Number(form.quantity || 0),
      unit_price: Number(form.unit_price || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sale ? 'Edit Sale' : 'Record Sale'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor={fid('product_id')}>Product *</Label>
            <Select value={form.product_id} onValueChange={(value) => setForm({ ...form, product_id: value })}>
              <SelectTrigger {...fieldProps('product_id')} aria-required="true"><SelectValue placeholder="Select a product" /></SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem
                    key={product.id}
                    value={product.id}
                    disabled={!sale && (Number(product.stock_quantity || 0) <= 0 || product.status !== 'active')}
                  >
                    {product.name} ({product.stock_quantity} in stock)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProduct && (
              <p className="mt-1 text-xs text-muted-foreground">
                Available stock: {selectedProduct.stock_quantity} in {selectedProduct.warehouse_name || 'default warehouse'}
              </p>
            )}
            {!sale && selectedProduct?.status !== 'active' && (
              <p className="mt-1 text-xs text-destructive" role="alert">This product is not active and cannot be sold.</p>
            )}
            {!sale && !selectedProduct && products.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Select a product to record this sale.</p>
            )}
            {!sale && products.length === 0 && (
              <p className="mt-1 text-xs text-destructive" role="alert">No products are available to sell.</p>
            )}
            {exceedsStock && (
              <p className="mt-1 text-xs text-destructive" role="alert">
                Quantity exceeds available stock ({selectedProduct.stock_quantity}).
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('quantity')}>Quantity *</Label>
              <Input {...fieldProps('quantity')} aria-required="true" type="number" min="1" step="1" inputMode="numeric" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} onInvalid={flagInvalid('quantity', 'Quantity is required.')} required />
              {errorFor('quantity')}
            </div>
            <div>
              <Label htmlFor={fid('unit_price')}>Unit Price *</Label>
              <Input {...fieldProps('unit_price')} aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} onInvalid={flagInvalid('unit_price', 'Unit price is required.')} required />
              {errorFor('unit_price')}
            </div>
            <div>
              <Label htmlFor={fid('customer_name')}>Customer</Label>
              <Input {...fieldProps('customer_name')} value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} placeholder="Walk-in or account name" />
            </div>
            <div>
              <Label htmlFor={fid('customer_email')}>Customer Email</Label>
              <Input {...fieldProps('customer_email')} type="email" value={form.customer_email} onChange={(event) => setForm({ ...form, customer_email: event.target.value })} placeholder="invoice@example.com" />
              {errorFor('customer_email')}
            </div>
            <div>
              <Label htmlFor={fid('customer_phone')}>WhatsApp / Phone</Label>
              <Input {...fieldProps('customer_phone')} type="tel" inputMode="tel" value={form.customer_phone} onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} placeholder="+1 555 0100" />
            </div>
            <div>
              <Label htmlFor={fid('sale_date')}>Sale Date</Label>
              <Input {...fieldProps('sale_date')} type="date" value={form.sale_date} onChange={(event) => setForm({ ...form, sale_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('payment_status')}>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger {...fieldProps('payment_status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('channel')}>Channel</Label>
              <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                <SelectTrigger {...fieldProps('channel')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
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
            <Button
              type="submit"
              disabled={
                isSaving ||
                !form.product_id ||
                products.length === 0 ||
                (!sale && selectedProduct?.status !== 'active') ||
                (!sale && selectedProduct && Number(form.quantity || 0) > Number(selectedProduct.stock_quantity || 0))
              }
            >
              {isSaving ? 'Saving…' : sale ? 'Update Sale' : 'Create Sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
