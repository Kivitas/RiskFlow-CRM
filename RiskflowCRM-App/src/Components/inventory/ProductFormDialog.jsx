import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function ProductFormDialog({ open, onOpenChange, product, warehouses = [], onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    const nextForm = product
      ? { ...initialForm, ...product }
      : { ...initialForm, warehouse_id: warehouses[0]?.id || '' };
    setForm(nextForm);
  }, [product, open, warehouses]);

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Product Name *</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div>
              <Label>SKU *</Label>
              <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} required />
            </div>
            <div>
              <Label>Barcode / UPC</Label>
              <Input value={form.barcode || ''} onChange={(event) => setForm({ ...form, barcode: event.target.value })} placeholder="Scan or type barcode" />
            </div>
            <div>
              <Label>AR / 3D Reference</Label>
              <Input value={form.ar_reference || ''} onChange={(event) => setForm({ ...form, ar_reference: event.target.value })} placeholder="Model URL, SKU-3D, or asset ID" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Warehouse</Label>
              <Select value={form.warehouse_id} onValueChange={(value) => setForm({ ...form, warehouse_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit Price</Label>
              <Input type="number" min="0" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} />
            </div>
            <div>
              <Label>Cost Price</Label>
              <Input type="number" min="0" value={form.cost_price} onChange={(event) => setForm({ ...form, cost_price: event.target.value })} />
            </div>
            <div>
              <Label>Stock Quantity</Label>
              <Input type="number" min="0" value={form.stock_quantity} onChange={(event) => setForm({ ...form, stock_quantity: event.target.value })} />
            </div>
            <div>
              <Label>Reorder Level</Label>
              <Input type="number" min="0" value={form.reorder_level} onChange={(event) => setForm({ ...form, reorder_level: event.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!form.warehouse_id && warehouses.length > 0}>{product ? 'Update Product' : 'Create Product'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
