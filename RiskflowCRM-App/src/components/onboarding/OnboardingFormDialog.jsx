import React, { useId, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label, FieldError } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initial = {
  client_name: '', company: '', email: '', phone: '',
  onboarding_stage: 'intake', assigned_to: '', priority: 'medium',
  kyc_status: 'pending', documents_required: 5, notes: '',
  target_completion_date: '', nationality: '', date_of_birth: '',
  id_number: '', risk_profile: 'moderate', investment_amount: '',
  source_of_funds: '',
};

export default function OnboardingFormDialog({ open, onOpenChange, client, onSave, isSaving = false }) {
  const [form, setForm] = useState(initial);
  const baseId = useId();
  const fid = (name) => `${baseId}-${name}`;
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(client ? { ...initial, ...client } : initial);
  }, [client, open]);

  useEffect(() => {
    setErrors({});
  }, [form]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

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
    onSave({ ...form, investment_amount: form.investment_amount ? Number(form.investment_amount) : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'New Onboarding Client'}</DialogTitle>
          <DialogDescription>Fields marked * are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Section: Personal Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={fid('client_name')}>Full Name *</Label>
                <Input {...fieldProps('client_name')} aria-required="true" value={form.client_name} onChange={e => set('client_name', e.target.value)} onInvalid={flagInvalid('client_name', 'Full name is required.')} required placeholder="John Smith" />
                {errorFor('client_name')}
              </div>
              <div>
                <Label htmlFor={fid('company')}>Company / Organization</Label>
                <Input {...fieldProps('company')} value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <Label htmlFor={fid('email')}>Email *</Label>
                <Input {...fieldProps('email')} aria-required="true" type="email" value={form.email} onChange={e => set('email', e.target.value)} onInvalid={flagInvalid('email', 'Email is required.')} required placeholder="john@example.com" />
                {errorFor('email')}
              </div>
              <div>
                <Label htmlFor={fid('phone')}>Phone</Label>
                <Input {...fieldProps('phone')} type="tel" inputMode="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <Label htmlFor={fid('nationality')}>Nationality</Label>
                <Input {...fieldProps('nationality')} value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. American" />
              </div>
              <div>
                <Label htmlFor={fid('date_of_birth')}>Date of Birth</Label>
                <Input {...fieldProps('date_of_birth')} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label htmlFor={fid('id_number')}>ID / Passport Number</Label>
                <Input {...fieldProps('id_number')} value={form.id_number} onChange={e => set('id_number', e.target.value)} placeholder="e.g. A1234567" />
              </div>
            </div>
          </div>

          {/* Section: Financial */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financial Profile</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={fid('investment_amount')}>Investment Amount ($)</Label>
                <Input {...fieldProps('investment_amount')} type="number" min={0} step="0.01" inputMode="decimal" value={form.investment_amount} onChange={e => set('investment_amount', e.target.value)} placeholder="250000" />
              </div>
              <div>
                <Label htmlFor={fid('risk_profile')}>Risk Profile</Label>
                <Select value={form.risk_profile} onValueChange={v => set('risk_profile', v)}>
                  <SelectTrigger {...fieldProps('risk_profile')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor={fid('source_of_funds')}>Source of Funds</Label>
                <Input {...fieldProps('source_of_funds')} value={form.source_of_funds} onChange={e => set('source_of_funds', e.target.value)} placeholder="e.g. Business income, inheritance, savings" />
              </div>
            </div>
          </div>

          {/* Section: Onboarding */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Onboarding Settings</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor={fid('onboarding_stage')}>Stage</Label>
                <Select value={form.onboarding_stage} onValueChange={v => set('onboarding_stage', v)}>
                  <SelectTrigger {...fieldProps('onboarding_stage')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intake">Intake</SelectItem>
                    <SelectItem value="kyc_verification">KYC Verification</SelectItem>
                    <SelectItem value="risk_profiling">Risk Profiling</SelectItem>
                    <SelectItem value="document_collection">Document Collection</SelectItem>
                    <SelectItem value="account_setup">Account Setup</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={fid('priority')}>Priority</Label>
                <Select value={form.priority} onValueChange={v => set('priority', v)}>
                  <SelectTrigger {...fieldProps('priority')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={fid('kyc_status')}>KYC Status</Label>
                <Select value={form.kyc_status} onValueChange={v => set('kyc_status', v)}>
                  <SelectTrigger {...fieldProps('kyc_status')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor={fid('assigned_to')}>Assigned To</Label>
                <Input {...fieldProps('assigned_to')} value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Team member name" />
              </div>
              <div>
                <Label htmlFor={fid('documents_required')}>Documents Required</Label>
                <Input {...fieldProps('documents_required')} type="number" min={0} step={1} inputMode="numeric" value={form.documents_required} onChange={e => set('documents_required', Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor={fid('target_completion_date')}>Target Completion</Label>
                <Input {...fieldProps('target_completion_date')} type="date" value={form.target_completion_date} onChange={e => set('target_completion_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor={fid('notes')}>Notes</Label>
            <Textarea {...fieldProps('notes')} value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any important notes about this client..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : client ? 'Update Client' : 'Create Client'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
