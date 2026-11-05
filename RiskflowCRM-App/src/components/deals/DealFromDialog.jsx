import React, { useId, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initial = { title: '', value: 0, stage: 'discovery', probability: 25, expected_close_date: '', notes: '', priority: 'medium', contact_name: '' };

export default function DealFormDialog({ open, onOpenChange, deal, onSave, isSaving = false }) {
  const [form, setForm] = useState(initial);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(deal ? { ...initial, ...deal } : initial);
  }, [deal, open]);

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
    onSave({
      ...form,
      value: Number(form.value || 0),
      probability: Number(form.probability || 0),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? 'Edit Deal' : 'New Deal'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor={fid('title')}>Deal Title *</Label>
            <Input {...fieldProps('title')} aria-required="true" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} onInvalid={flagInvalid('title', 'Deal title is required.')} required />
            {errorFor('title')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('value')}>Value ($) *</Label>
              <Input {...fieldProps('value')} aria-required="true" type="number" min={0} step="0.01" inputMode="decimal" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} onInvalid={flagInvalid('value', 'Deal value is required.')} required />
              {errorFor('value')}
            </div>
            <div>
              <Label htmlFor={fid('probability')}>Probability (%)</Label>
              <Input {...fieldProps('probability')} type="number" min={0} max={100} step={1} inputMode="numeric" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('stage')}>Stage</Label>
              <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v })}>
                <SelectTrigger {...fieldProps('stage')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">Discovery</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed_won">Closed Won</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('priority')}>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm({ ...form, priority: v })}>
                <SelectTrigger {...fieldProps('priority')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('contact_name')}>Contact Name</Label>
              <Input {...fieldProps('contact_name')} value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor={fid('expected_close_date')}>Expected Close</Label>
              <Input {...fieldProps('expected_close_date')} type="date" value={form.expected_close_date} onChange={e => setForm({ ...form, expected_close_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor={fid('notes')}>Notes</Label>
            <Textarea {...fieldProps('notes')} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : deal ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
