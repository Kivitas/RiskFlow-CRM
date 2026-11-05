import React, { useId, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initial = { first_name: '', last_name: '', email: '', phone: '', company: '', job_title: '', status: 'lead', source: 'website', notes: '', lifetime_value: 0 };

export default function ContactFormDialog({ open, onOpenChange, contact, onSave, isSaving = false }) {
  const [form, setForm] = useState(initial);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(contact ? { ...initial, ...contact } : initial);
  }, [contact, open]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit Contact' : 'New Contact'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('first_name')}>First Name *</Label>
              <Input {...fieldProps('first_name')} aria-required="true" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} onInvalid={flagInvalid('first_name', 'First name is required.')} required />
              {errorFor('first_name')}
            </div>
            <div>
              <Label htmlFor={fid('last_name')}>Last Name *</Label>
              <Input {...fieldProps('last_name')} aria-required="true" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} onInvalid={flagInvalid('last_name', 'Last name is required.')} required />
              {errorFor('last_name')}
            </div>
          </div>
          <div>
            <Label htmlFor={fid('email')}>Email *</Label>
            <Input {...fieldProps('email')} aria-required="true" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} onInvalid={flagInvalid('email', 'Email is required.')} required />
            {errorFor('email')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('phone')}>Phone</Label>
              <Input {...fieldProps('phone')} type="tel" inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('company')}>Company</Label>
              <Input {...fieldProps('company')} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('job_title')}>Job Title</Label>
              <Input {...fieldProps('job_title')} value={form.job_title} onChange={e => setForm({ ...form, job_title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('lifetime_value')}>Lifetime Value ($)</Label>
              <Input {...fieldProps('lifetime_value')} type="number" min={0} step="0.01" inputMode="decimal" value={form.lifetime_value} onChange={e => setForm({ ...form, lifetime_value: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('status')}>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger {...fieldProps('status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="churned">Churned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('source')}>Source</Label>
              <Select value={form.source} onValueChange={v => setForm({ ...form, source: v })}>
                <SelectTrigger {...fieldProps('source')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="cold_call">Cold Call</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="social_media">Social Media</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor={fid('notes')}>Notes</Label>
            <Textarea {...fieldProps('notes')} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : contact ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
