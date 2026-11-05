import React, { useEffect, useId, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const initialForm = {
  full_name: '',
  email: '',
  role: 'user',
  status: 'active',
  ai_enabled: true,
  password: '',
};

export default function UserFormDialog({ open, onOpenChange, user, onSave, isSaving = false }) {
  const [form, setForm] = useState(initialForm);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(user ? { ...initialForm, ...user, password: '' } : initialForm);
  }, [user, open]);

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
          <DialogTitle>{user ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={fid('full_name')}>Full Name *</Label>
              <Input {...fieldProps('full_name')} aria-required="true" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} onInvalid={flagInvalid('full_name', 'Full name is required.')} required />
              {errorFor('full_name')}
            </div>
            <div>
              <Label htmlFor={fid('email')}>Email *</Label>
              <Input {...fieldProps('email')} aria-required="true" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} onInvalid={flagInvalid('email', 'Email is required.')} required />
              {errorFor('email')}
            </div>
            <div>
              <Label htmlFor={fid('role')}>Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm({ ...form, role: value })}>
                <SelectTrigger {...fieldProps('role')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
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
            <Label htmlFor={fid('password')}>{user ? 'Reset Password' : 'Password *'}</Label>
            <Input
              {...fieldProps('password')}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              onInvalid={flagInvalid('password', 'Password is required.')}
              placeholder={user ? 'Leave blank to keep current password' : 'Temporary password'}
              aria-required={user ? undefined : 'true'}
              required={!user}
            />
            {errorFor('password')}
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
            <div>
              <p id={fid('ai_enabled-label')} className="text-sm font-medium text-card-foreground">Allow AI access</p>
              <p className="text-xs text-muted-foreground">Admin can disable in-app AI chat for this user.</p>
            </div>
            <Switch
              id={fid('ai_enabled')}
              aria-labelledby={fid('ai_enabled-label')}
              checked={form.ai_enabled !== false}
              onCheckedChange={(checked) => setForm({ ...form, ai_enabled: checked })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : user ? 'Save Changes' : 'Create User'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
