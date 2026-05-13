import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function OnboardingFormDialog({ open, onOpenChange, client, onSave }) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(client ? { ...initial, ...client } : initial);
  }, [client, open]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, investment_amount: form.investment_amount ? Number(form.investment_amount) : undefined });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'New Onboarding Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Section: Personal Info */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.client_name} onChange={e => set('client_name', e.target.value)} required placeholder="John Smith" />
              </div>
              <div>
                <Label>Company / Organization</Label>
                <Input value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Corp" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="john@example.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 000 0000" />
              </div>
              <div>
                <Label>Nationality</Label>
                <Input value={form.nationality} onChange={e => set('nationality', e.target.value)} placeholder="e.g. American" />
              </div>
              <div>
                <Label>Date of Birth</Label>
                <Input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>ID / Passport Number</Label>
                <Input value={form.id_number} onChange={e => set('id_number', e.target.value)} placeholder="e.g. A1234567" />
              </div>
            </div>
          </div>

          {/* Section: Financial */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financial Profile</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Investment Amount ($)</Label>
                <Input type="number" value={form.investment_amount} onChange={e => set('investment_amount', e.target.value)} placeholder="250000" />
              </div>
              <div>
                <Label>Risk Profile</Label>
                <Select value={form.risk_profile} onValueChange={v => set('risk_profile', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Source of Funds</Label>
                <Input value={form.source_of_funds} onChange={e => set('source_of_funds', e.target.value)} placeholder="e.g. Business income, inheritance, savings" />
              </div>
            </div>
          </div>

          {/* Section: Onboarding */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Onboarding Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stage</Label>
                <Select value={form.onboarding_stage} onValueChange={v => set('onboarding_stage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => set('priority', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>KYC Status</Label>
                <Select value={form.kyc_status} onValueChange={v => set('kyc_status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_review">In Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assigned To</Label>
                <Input value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)} placeholder="Team member name" />
              </div>
              <div>
                <Label>Documents Required</Label>
                <Input type="number" min={0} value={form.documents_required} onChange={e => set('documents_required', Number(e.target.value))} />
              </div>
              <div>
                <Label>Target Completion</Label>
                <Input type="date" value={form.target_completion_date} onChange={e => set('target_completion_date', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Any important notes about this client..." />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{client ? 'Update Client' : 'Create Client'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}