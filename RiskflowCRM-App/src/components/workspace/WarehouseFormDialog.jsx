import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialForm = {
  name: '',
  code: '',
  location: '',
  manager_name: '',
  status: 'active',
};

export default function WarehouseFormDialog({ open, onOpenChange, warehouse, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(warehouse ? { ...initialForm, ...warehouse } : initialForm);
  }, [warehouse, open]);

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
          <DialogTitle>{warehouse ? 'Edit Warehouse' : 'Add Warehouse'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave(form);
          }}
          className="space-y-4"
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('name')}>Name *</Label>
              <Input {...fieldProps('name')} aria-required="true" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} onInvalid={flagInvalid('name', 'Warehouse name is required.')} required />
              {errorFor('name')}
            </div>
            <div>
              <Label htmlFor={fid('code')}>Code *</Label>
              <Input {...fieldProps('code')} aria-required="true" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} onInvalid={flagInvalid('code', 'Warehouse code is required.')} required />
              {errorFor('code')}
            </div>
            <div>
              <Label htmlFor={fid('location')}>Location</Label>
              <Input {...fieldProps('location')} value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('manager_name')}>Manager</Label>
              <Input {...fieldProps('manager_name')} value={form.manager_name} onChange={(event) => setForm({ ...form, manager_name: event.target.value })} />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : warehouse ? 'Save Changes' : 'Create Warehouse'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
