import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const initial = { title: '', category: 'credit', severity: 'medium', likelihood: 'possible', impact_score: 5, status: 'identified', description: '', mitigation_plan: '', owner: '', review_date: '' };

export default function RiskFormDialog({ open, onOpenChange, risk, onSave }) {
  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(risk ? { ...initial, ...risk } : initial);
  }, [risk, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{risk ? 'Edit Risk' : 'New Risk Assessment'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Risk Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Severity *</Label>
              <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Likelihood</Label>
              <Select value={form.likelihood} onValueChange={v => setForm({ ...form, likelihood: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Impact Score (1-10)</Label>
              <Input type="number" min={1} max={10} value={form.impact_score} onChange={e => setForm({ ...form, impact_score: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Label>Owner</Label>
              <Input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Review Date</Label>
            <Input type="date" value={form.review_date} onChange={e => setForm({ ...form, review_date: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div>
            <Label>Mitigation Plan</Label>
            <Textarea value={form.mitigation_plan} onChange={e => setForm({ ...form, mitigation_plan: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{risk ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}