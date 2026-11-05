import React, { useId, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initial = { title: '', category: 'credit', severity: 'medium', likelihood: 'possible', impact_score: 5, status: 'identified', description: '', mitigation_plan: '', owner: '', review_date: '' };

export default function RiskFormDialog({ open, onOpenChange, risk, onSave, isSaving = false }) {
  const [form, setForm] = useState(initial);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(risk ? { ...initial, ...risk } : initial);
  }, [risk, open]);

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
          <DialogTitle>{risk ? 'Edit Risk' : 'New Risk Assessment'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor={fid('title')}>Risk Title *</Label>
            <Input {...fieldProps('title')} aria-required="true" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} onInvalid={flagInvalid('title', 'Risk title is required.')} required />
            {errorFor('title')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('category')}>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger {...fieldProps('category')} aria-required="true"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="market">Market</SelectItem>
                  <SelectItem value="operational">Operational</SelectItem>
                  <SelectItem value="liquidity">Liquidity</SelectItem>
                  <SelectItem value="compliance">Compliance</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('severity')}>Severity *</Label>
              <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                <SelectTrigger {...fieldProps('severity')} aria-required="true"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('likelihood')}>Likelihood</Label>
              <Select value={form.likelihood} onValueChange={v => setForm({ ...form, likelihood: v })}>
                <SelectTrigger {...fieldProps('likelihood')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="unlikely">Unlikely</SelectItem>
                  <SelectItem value="possible">Possible</SelectItem>
                  <SelectItem value="likely">Likely</SelectItem>
                  <SelectItem value="almost_certain">Almost Certain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('impact_score')}>Impact Score (1-10)</Label>
              <Input {...fieldProps('impact_score')} type="number" min={1} max={10} step={1} inputMode="numeric" value={form.impact_score} onChange={e => setForm({ ...form, impact_score: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor={fid('status')}>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger {...fieldProps('status')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="analyzing">Analyzing</SelectItem>
                  <SelectItem value="mitigating">Mitigating</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={fid('owner')}>Owner</Label>
              <Input {...fieldProps('owner')} value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor={fid('review_date')}>Review Date</Label>
            <Input {...fieldProps('review_date')} type="date" value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} />
          </div>
          <div>
            <Label htmlFor={fid('description')}>Description</Label>
            <Textarea {...fieldProps('description')} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div>
            <Label htmlFor={fid('mitigation_plan')}>Mitigation Plan</Label>
            <Textarea {...fieldProps('mitigation_plan')} value={form.mitigation_plan} onChange={e => setForm({ ...form, mitigation_plan: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : risk ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
