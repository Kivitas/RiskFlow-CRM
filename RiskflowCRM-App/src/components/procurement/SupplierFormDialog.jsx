import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initialForm = {
  name: '',
  contact_person: '',
  email: '',
  phone: '',
  payment_terms: 'Net 30',
  status: 'active',
  notes: '',
};

export default function SupplierFormDialog({ open, onOpenChange, supplier, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(supplier ? { ...initialForm, ...supplier } : initialForm);
  }, [supplier, open]);

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

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('name')}>Supplier Name *</Label>
              <Input {...fieldProps('name')} aria-required="true" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} onInvalid={flagInvalid('name', 'Supplier name is required.')} required />
              {errorFor('name')}
            </div>
            <div>
              <Label htmlFor={fid('contact_person')}>Contact Person</Label>
              <Input {...fieldProps('contact_person')} value={form.contact_person} onChange={(event) => setForm({ ...form, contact_person: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('email')}>Email</Label>
              <Input {...fieldProps('email')} inputMode="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('phone')}>Phone</Label>
              <Input {...fieldProps('phone')} type="tel" inputMode="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('payment_terms')}>Payment Terms</Label>
              <Input {...fieldProps('payment_terms')} value={form.payment_terms} onChange={(event) => setForm({ ...form, payment_terms: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('status')}>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger {...fieldProps('status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
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
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : supplier ? 'Update Supplier' : 'Create Supplier'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
