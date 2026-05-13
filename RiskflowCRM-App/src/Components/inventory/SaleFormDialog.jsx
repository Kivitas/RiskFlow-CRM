import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function SaleFormDialog({ open, onOpenChange, sale, products, onSave, initialProductId = '' }) {
  const [form, setForm] = useState(initialForm);

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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{sale ? 'Edit Sale' : 'Record Sale'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Product *</Label>
            <Select value={form.product_id} onValueChange={(value) => setForm({ ...form, product_id: value })}>
              <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
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
              <p className="mt-1 text-xs text-destructive">This product is not active and cannot be sold.</p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required />
            </div>
            <div>
              <Label>Unit Price *</Label>
              <Input type="number" min="0" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} required />
            </div>
            <div>
              <Label>Customer</Label>
              <Input value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} placeholder="Walk-in or account name" />
            </div>
            <div>
              <Label>Customer Email</Label>
              <Input type="email" value={form.customer_email} onChange={(event) => setForm({ ...form, customer_email: event.target.value })} placeholder="invoice@example.com" />
            </div>
            <div>
              <Label>WhatsApp / Phone</Label>
              <Input value={form.customer_phone} onChange={(event) => setForm({ ...form, customer_phone: event.target.value })} placeholder="+1 555 0100" />
            </div>
            <div>
              <Label>Sale Date</Label>
              <Input type="date" value={form.sale_date} onChange={(event) => setForm({ ...form, sale_date: event.target.value })} />
            </div>
            <div>
              <Label>Payment Status</Label>
              <Select value={form.payment_status} onValueChange={(value) => setForm({ ...form, payment_status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Channel</Label>
              <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              type="submit"
              disabled={
                !form.product_id ||
                products.length === 0 ||
                (!sale && selectedProduct?.status !== 'active') ||
                (!sale && selectedProduct && Number(form.quantity || 0) > Number(selectedProduct.stock_quantity || 0))
              }
            >
              {sale ? 'Update Sale' : 'Create Sale'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
