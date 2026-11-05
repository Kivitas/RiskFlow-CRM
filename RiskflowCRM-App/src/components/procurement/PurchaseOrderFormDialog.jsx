import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  supplier_id: '',
  product_id: '',
  quantity: 1,
  unit_cost: 0,
  order_date: new Date().toISOString().slice(0, 10),
  expected_date: new Date().toISOString().slice(0, 10),
  status: 'ordered',
  payment_status: 'pending',
  notes: '',
};

export default function PurchaseOrderFormDialog({ open, onOpenChange, order, suppliers, products, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(order ? { ...initialForm, ...order } : initialForm);
  }, [order, open]);

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

  const selectedSupplier = suppliers.find((supplier) => supplier.id === form.supplier_id);
  const selectedProduct = products.find((product) => product.id === form.product_id);

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      quantity: Number(form.quantity || 0),
      unit_cost: Number(form.unit_cost || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Edit Purchase Order' : 'Create Purchase Order'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('supplier_id')}>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={(value) => setForm({ ...form, supplier_id: value })}>
                <SelectTrigger {...fieldProps('supplier_id')} aria-required="true"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id} disabled={!order && supplier.status !== 'active'}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!order && selectedSupplier?.status !== 'active' && selectedSupplier && (
                <p className="mt-1 text-xs text-destructive" role="alert">This supplier is inactive and cannot receive new purchase orders.</p>
              )}
            </div>
            <div>
              <Label htmlFor={fid('product_id')}>Product *</Label>
              <Select
                value={form.product_id}
                onValueChange={(value) => {
                  // Prefill the unit cost from the product only when the product is chosen, so manual edits stick.
                  const product = products.find((item) => item.id === value);
                  setForm((current) => ({
                    ...current,
                    product_id: value,
                    ...(!order && product ? { unit_cost: product.cost_price || 0 } : {}),
                  }));
                }}
              >
                <SelectTrigger {...fieldProps('product_id')} aria-required="true"><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id} disabled={!order && product.status === 'discontinued'}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!order && selectedProduct?.status === 'discontinued' && (
                <p className="mt-1 text-xs text-destructive" role="alert">Discontinued products cannot be used for new purchase orders.</p>
              )}
            </div>
            <div>
              <Label htmlFor={fid('quantity')}>Quantity *</Label>
              <Input {...fieldProps('quantity')} aria-required="true" type="number" min="1" step="1" inputMode="numeric" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} onInvalid={flagInvalid('quantity', 'Quantity is required.')} required />
              {errorFor('quantity')}
            </div>
            <div>
              <Label htmlFor={fid('unit_cost')}>Unit Cost *</Label>
              <Input {...fieldProps('unit_cost')} aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" value={form.unit_cost} onChange={(event) => setForm({ ...form, unit_cost: event.target.value })} onInvalid={flagInvalid('unit_cost', 'Unit cost is required.')} required />
              {errorFor('unit_cost')}
            </div>
            <div>
              <Label htmlFor={fid('order_date')}>Order Date</Label>
              <Input {...fieldProps('order_date')} type="date" value={form.order_date} onChange={(event) => setForm({ ...form, order_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('expected_date')}>Expected Date</Label>
              <Input {...fieldProps('expected_date')} type="date" value={form.expected_date} onChange={(event) => setForm({ ...form, expected_date: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('status')}>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger {...fieldProps('status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('payment_status')}>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger {...fieldProps('payment_status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
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
                !form.supplier_id ||
                !form.product_id ||
                (!order && selectedSupplier?.status !== 'active') ||
                (!order && selectedProduct?.status === 'discontinued')
              }
            >
              {isSaving ? 'Saving…' : order ? 'Update Order' : 'Create Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
