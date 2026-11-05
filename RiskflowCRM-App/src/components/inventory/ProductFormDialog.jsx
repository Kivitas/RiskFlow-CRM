import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  name: '',
  sku: '',
  barcode: '',
  ar_reference: '',
  category: 'general',
  unit_price: 0,
  cost_price: 0,
  stock_quantity: 0,
  reorder_level: 5,
  status: 'active',
  description: '',
  warehouse_id: '',
};

export default function ProductFormDialog({ open, onOpenChange, product, warehouses = [], onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const nextForm = product
      ? { ...initialForm, ...product }
      : { ...initialForm, warehouse_id: warehouses[0]?.id || '' };
    setForm(nextForm);
  }, [product, open, warehouses]);

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

  const warehouseMissing = !form.warehouse_id && warehouses.length > 0;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      unit_price: Number(form.unit_price || 0),
      cost_price: Number(form.cost_price || 0),
      stock_quantity: Number(form.stock_quantity || 0),
      reorder_level: Number(form.reorder_level || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('name')}>Product Name *</Label>
              <Input {...fieldProps('name')} aria-required="true" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} onInvalid={flagInvalid('name', 'Product name is required.')} required />
              {errorFor('name')}
            </div>
            <div>
              <Label htmlFor={fid('sku')}>SKU *</Label>
              <Input {...fieldProps('sku')} aria-required="true" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} onInvalid={flagInvalid('sku', 'SKU is required.')} required />
              {errorFor('sku')}
            </div>
            <div>
              <Label htmlFor={fid('barcode')}>Barcode / UPC</Label>
              <Input {...fieldProps('barcode')} value={form.barcode || ''} onChange={(event) => setForm({ ...form, barcode: event.target.value })} placeholder="Scan or type barcode" />
            </div>
            <div>
              <Label htmlFor={fid('ar_reference')}>AR / 3D Reference</Label>
              <Input {...fieldProps('ar_reference')} value={form.ar_reference || ''} onChange={(event) => setForm({ ...form, ar_reference: event.target.value })} placeholder="Model URL, SKU-3D, or asset ID" />
            </div>
            <div>
              <Label htmlFor={fid('category')}>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger {...fieldProps('category')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="hardware">Hardware</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('status')}>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger {...fieldProps('status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('warehouse_id')}>Warehouse</Label>
              <Select value={form.warehouse_id} onValueChange={(value) => setForm({ ...form, warehouse_id: value })}>
                <SelectTrigger {...fieldProps('warehouse_id')} aria-required={warehouses.length > 0 ? 'true' : undefined}><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {warehouseMissing && (
                <p className="mt-1 text-xs text-destructive" role="alert">Select a warehouse before saving this product.</p>
              )}
            </div>
            <div>
              <Label htmlFor={fid('unit_price')}>Unit Price</Label>
              <Input {...fieldProps('unit_price')} type="number" min="0" step="0.01" inputMode="decimal" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('cost_price')}>Cost Price</Label>
              <Input {...fieldProps('cost_price')} type="number" min="0" step="0.01" inputMode="decimal" value={form.cost_price} onChange={(event) => setForm({ ...form, cost_price: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('stock_quantity')}>Stock Quantity</Label>
              <Input {...fieldProps('stock_quantity')} type="number" min="0" step="1" inputMode="numeric" value={form.stock_quantity} onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('reorder_level')}>Reorder Level</Label>
              <Input {...fieldProps('reorder_level')} type="number" min="0" step="1" inputMode="numeric" value={form.reorder_level} onChange={(event) => setForm({ ...form, reorder_level: event.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor={fid('description')}>Description</Label>
            <Textarea {...fieldProps('description')} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || warehouseMissing}>
              {isSaving ? 'Saving…' : product ? 'Update Product' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
