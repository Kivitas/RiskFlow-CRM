import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Building2, Calendar,
  Plus, Pencil, Trash2, Globe, TrendingUp, MessageSquare, CheckSquare,
  Users, ShieldAlert, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import ContactFormDialog from '@/components/contacts/ContactFormDialog';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';

const statusColors = {
  lead: 'bg-blue-100 text-blue-700 border-blue-200',
  prospect: 'bg-amber-100 text-amber-700 border-amber-200',
  customer: 'bg-green-100 text-green-700 border-green-200',
  churned: 'bg-red-100 text-red-700 border-red-200',
};

const activityTypeConfig = {
  call: { icon: Phone, color: 'text-blue-600', bg: 'bg-blue-50' },
  email: { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-50' },
  meeting: { icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
  note: { icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
  task: { icon: CheckSquare, color: 'text-green-600', bg: 'bg-green-50' },
  deal_update: { icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  risk_alert: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10' },
};

const safeParse = (d) => { try { return parseISO(d); } catch { return new Date(); } };

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { formatMoney } = useCurrency();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [activityType, setActivityType] = useState('note');
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDesc, setActivityDesc] = useState('');
  const [showActivityForm, setShowActivityForm] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const all = await crmClient.entities.Contact.list();
      return all.find(c => c.id === id);
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['deals'],
    queryFn: () => crmClient.entities.Deal.list(),
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['activities'],
    queryFn: () => crmClient.entities.Activity.list('-created_date', 50),
  });

  const contactDeals = deals.filter(d =>
    d.contact_id === id || d.contact_name === `${contact?.first_name} ${contact?.last_name}`
  );

  const contactActivities = activities.filter(a =>
    a.related_id === id || a.contact_name === `${contact?.first_name} ${contact?.last_name}`
  );

  const updateMutation = useMutation({
    mutationFn: (data) => crmClient.entities.Contact.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contact', id] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => crmClient.contacts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
      navigate('/contacts');
    },
  });

  const addActivityMutation = useMutation({
    mutationFn: (data) => crmClient.entities.Activity.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      setActivityTitle('');
      setActivityDesc('');
      setShowActivityForm(false);
    },
  });

  const handleAddActivity = () => {
    if (!activityTitle.trim() || !contact) return;
    addActivityMutation.mutate({
      type: activityType,
      title: activityTitle,
      description: activityDesc,
      related_entity: 'Contact',
      related_id: id,
      contact_name: `${contact.first_name} ${contact.last_name}`,
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!contact) return (
    <div className="text-center py-20 text-muted-foreground">Contact not found.</div>
  );

  const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase();
  const totalDealValue = contactDeals.reduce((s, d) => s + (d.value || 0), 0);
  const wonDeals = contactDeals.filter(d => d.stage === 'closed_won');

  return (
    <div>
      <div className="mb-6">
        <Link to="/contacts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Contacts
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT - Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-card-foreground">{contact.first_name} {contact.last_name}</h1>
                  <p className="text-sm text-muted-foreground">{contact.job_title || 'No title'}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: 'Delete contact?',
                      description: 'This removes the contact and clears linked deals and activity records.',
                      confirmLabel: 'Delete contact',
                      destructive: true,
                    });
                    if (confirmed) deleteMutation.mutate();
                  }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <Badge variant="outline" className={cn("text-xs capitalize mb-4", statusColors[contact.status])}>
              {contact.status}
            </Badge>

            <div className="space-y-3">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <span>{contact.phone}</span>
                </a>
              )}
              {contact.company && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span>{contact.company}</span>
                </div>
              )}
              {contact.source && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Globe className="w-3.5 h-3.5" />
                  </div>
                  <span className="capitalize">{contact.source.replace(/_/g, ' ')}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span>Added {contact.created_date ? format(safeParse(contact.created_date), 'MMM d, yyyy') : '-'}</span>
              </div>
            </div>

            {contact.notes && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Notes</p>
                <p className="text-sm text-card-foreground leading-relaxed">{contact.notes}</p>
              </div>
            )}
          </div>

          {/* Financial Summary */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Financial Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lifetime Value</span>
                <span className="text-sm font-bold text-card-foreground">{formatMoney(contact.lifetime_value || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Deals</span>
                <span className="text-sm font-bold text-card-foreground">{contactDeals.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Deals Won</span>
                <span className="text-sm font-bold text-accent">{wonDeals.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Deal Value</span>
                <span className="text-sm font-bold text-card-foreground">{formatMoney(totalDealValue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT - Deals + Activity */}
        <div className="lg:col-span-2 space-y-4">

          {/* Deals */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-card-foreground">Deals</h3>
              <Link to="/deals">
                <Button variant="outline" size="sm" className="text-xs h-7">View All</Button>
              </Link>
            </div>
            {contactDeals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No deals linked to this contact yet.</p>
            ) : (
              <div className="space-y-2">
                {contactDeals.map(deal => (
                  <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{deal.title}</p>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">
                        {deal.stage.replace(/_/g, ' ')} | {deal.probability}% probability
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-card-foreground">{formatMoney(deal.value)}</p>
                      {deal.expected_close_date && (
                        <p className="text-xs text-muted-foreground">{format(safeParse(deal.expected_close_date), 'MMM d')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-card-foreground">Activity Timeline</h3>
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowActivityForm(v => !v)}>
                <Plus className="w-3.5 h-3.5 mr-1" />Log Activity
              </Button>
            </div>

            {showActivityForm && (
              <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs w-full focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Title *"
                    value={activityTitle}
                    onChange={e => setActivityTitle(e.target.value)}
                  />
                </div>
                <Textarea
                  className="text-xs min-h-[60px]"
                  placeholder="Description (optional)"
                  value={activityDesc}
                  onChange={e => setActivityDesc(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowActivityForm(false)}>Cancel</Button>
                  <Button size="sm" className="text-xs h-7" onClick={handleAddActivity} disabled={!activityTitle.trim() || addActivityMutation.isPending}>Save</Button>
                </div>
              </div>
            )}

            {contactActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No activity logged yet. Log a call, email, or note above.</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {contactActivities.map(activity => {
                  const cfg = activityTypeConfig[activity.type] || activityTypeConfig.note;
                  const Icon = cfg.icon;
                  return (
                    <div key={activity.id} className="flex gap-3">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", cfg.bg)}>
                        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-card-foreground">{activity.title}</p>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {activity.created_date ? format(safeParse(activity.created_date), 'MMM d, h:mm a') : '-'}
                          </span>
                        </div>
                        {activity.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{activity.description}</p>}
                        <span className="text-[10px] text-muted-foreground capitalize mt-0.5 inline-block">{activity.type?.replace(/_/g, ' ')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ContactFormDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} onSave={(data) => updateMutation.mutate(data)} />
    </div>
  );
}
