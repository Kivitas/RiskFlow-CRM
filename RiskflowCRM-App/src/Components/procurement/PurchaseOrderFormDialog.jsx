import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function PurchaseOrderFormDialog({ open, onOpenChange, order, suppliers, products, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(order ? { ...initialForm, ...order } : initialForm);
  }, [order, open]);

  useEffect(() => {
    if (!order && form.product_id) {
      const product = products.find((item) => item.id === form.product_id);
      if (product) {
        setForm((current) => ({ ...current, unit_cost: product.cost_price || 0 }));
      }
    }
  }, [form.product_id, form.unit_cost, order, products]);

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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{order ? 'Edit Purchase Order' : 'Create Purchase Order'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={(value) => setForm({ ...form, supplier_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id} disabled={!order && supplier.status !== 'active'}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!order && selectedSupplier?.status !== 'active' && selectedSupplier && (
                <p className="mt-1 text-xs text-destructive">This supplier is inactive and cannot receive new purchase orders.</p>
              )}
            </div>
            <div>
              <Label>Product *</Label>
              <Select value={form.product_id} onValueChange={(value) => setForm({ ...form, product_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id} disabled={!order && product.status === 'discontinued'}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!order && selectedProduct?.status === 'discontinued' && (
                <p className="mt-1 text-xs text-destructive">Discontinued products cannot be used for new purchase orders.</p>
              )}
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
            </div>
            <div>
              <Label>Unit Cost *</Label>
              <Input type="number" min="0" value={form.unit_cost} onChange={(event) => setForm({ ...form, unit_cost: event.target.value })} required />
            </div>
            <div>
              <Label>Order Date</Label>
              <Input type="date" value={form.order_date} onChange={(event) => setForm({ ...form, order_date: event.target.value })} />
            </div>
            <div>
              <Label>Expected Date</Label>
              <Input type="date" value={form.expected_date} onChange={(event) => setForm({ ...form, expected_date: event.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
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
            <Button
              type="submit"
              disabled={
                !form.supplier_id ||
                !form.product_id ||
                (!order && selectedSupplier?.status !== 'active') ||
                (!order && selectedProduct?.status === 'discontinued')
              }
            >
              {order ? 'Update Order' : 'Create Order'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
