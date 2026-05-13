import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const initialForm = {
  name: '',
  code: '',
  location: '',
  manager_name: '',
  status: 'active',
};

export default function WarehouseFormDialog({ open, onOpenChange, warehouse, onSave }) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(warehouse ? { ...initialForm, ...warehouse } : initialForm);
  }, [warehouse, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{warehouse ? 'Edit Warehouse' : 'Add Warehouse'}</DialogTitle>
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
              <Label>Name *</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
            <div>
              <Label>Code *</Label>
              <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} required />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
            </div>
            <div>
              <Label>Manager</Label>
              <Input value={form.manager_name} onChange={(event) => setForm({ ...form, manager_name: event.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{warehouse ? 'Save Changes' : 'Create Warehouse'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
