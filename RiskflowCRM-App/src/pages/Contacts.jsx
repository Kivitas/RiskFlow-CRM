import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Mail, Phone, Users, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import Pagination, { paginate } from '@/components/shared/Pagination';
import ContactFormDialog from '@/components/contacts/ContactFormDialog';
import { cn } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';

const statusColors = {
  lead: 'bg-blue-50 text-blue-700 border-blue-200',
  prospect: 'bg-amber-50 text-amber-700 border-amber-200',
  customer: 'bg-green-50 text-green-700 border-green-200',
  churned: 'bg-red-50 text-red-700 border-red-200',
};

// parseISO never throws (it returns an Invalid Date) and format() throws on that, so guard both.
const formatDate = (value, pattern) => {
  if (!value) return '-';
  const date = parseISO(String(value));
  return isValid(date) ? format(date, pattern) : '-';
};

const thClass = 'text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3';

function SortHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={thClass} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
      >
        {label}
        <Icon className="w-3 h-3" aria-hidden="true" />
      </button>
    </th>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { formatMoney } = useCurrency();
  const confirm = useConfirm();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => crmClient.entities.Contact.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => crmClient.entities.Contact.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setDialogOpen(false); },
    onError: (e) => toast({ title: 'Contact save failed', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => crmClient.entities.Contact.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contacts'] }); setDialogOpen(false); setEditContact(null); },
    onError: (e) => toast({ title: 'Contact save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => crmClient.contacts.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['deals'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = contacts.filter(c => {
      const matchesSearch = !q || [c.first_name, c.last_name, c.email, c.company].filter(Boolean).join(' ').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    const mult = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === 'name') {
        return mult * `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(`${b.last_name || ''} ${b.first_name || ''}`);
      }
      return mult * String(a.created_date || '').localeCompare(String(b.created_date || ''));
    });
  }, [contacts, search, statusFilter, sort]);

  const pageRows = paginate(filtered, page);

  const handleSearch = (value) => { setSearch(value); setPage(1); };
  const handleStatus = (value) => { setStatusFilter(value); setPage(1); };
  const handleSort = (key) => {
    setSort(prev => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
    setPage(1);
  };

  const handleSave = (data) => {
    if (editContact) updateMutation.mutate({ id: editContact.id, data });
    else createMutation.mutate(data);
  };

  const counts = { all: contacts.length, lead: 0, prospect: 0, customer: 0, churned: 0 };
  contacts.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contacts in your CRM`}
        actions={
          <Button onClick={() => { setEditContact(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Contact
          </Button>
        }
      />

      {/* Status tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
        {['all', 'lead', 'prospect', 'customer', 'churned'].map(s => (
          <button
            key={s}
            onClick={() => handleStatus(s)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors -mb-px whitespace-nowrap",
              statusFilter === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {s} <span className="ml-1 text-xs text-muted-foreground">({counts[s] || 0})</span>
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search contacts"
            placeholder="Search by name, email, company..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden" aria-busy="true" aria-label="Loading contacts">
          <div className="overflow-x-auto">
            <div className="min-w-[800px] p-4 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-9 w-9 rounded-xl" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No contacts found" description="Start building your CRM by adding your first contact." actionLabel="Add Contact" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <SortHeader label="Name" sortKey="name" sort={sort} onSort={handleSort} />
                  <th className={thClass}>Company</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Source</th>
                  <th className={thClass}>Lifetime Value</th>
                  <SortHeader label="Added" sortKey="created" sort={sort} onSort={handleSort} />
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(contact => {
                  const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'contact';
                  return (
                    <tr
                      key={contact.id}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => navigate(`/contacts/${contact.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">{contact.first_name?.[0]}{contact.last_name?.[0]}</span>
                          </div>
                          <div>
                            <Link
                              to={`/contacts/${contact.id}`}
                              onClick={e => e.stopPropagation()}
                              className="text-sm font-semibold text-card-foreground rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {contact.first_name} {contact.last_name}
                            </Link>
                            <p className="text-xs text-muted-foreground">{contact.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-card-foreground">{contact.company || '-'}</p>
                        <p className="text-xs text-muted-foreground">{contact.job_title || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={cn("text-xs capitalize", statusColors[contact.status])}>{contact.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-muted-foreground capitalize">{contact.source?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-card-foreground">{formatMoney(contact.lifetime_value || 0)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(contact.created_date, 'MMM d, yyyy')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${name}`}>
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/contacts/${contact.id}`)}>
                              <Users className="w-3.5 h-3.5 mr-2" />View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditContact(contact); setDialogOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            {contact.email && (
                              <DropdownMenuItem onClick={() => window.open(`mailto:${contact.email}`)}>
                                <Mail className="w-3.5 h-3.5 mr-2" />Email
                              </DropdownMenuItem>
                            )}
                            {contact.phone && (
                              <DropdownMenuItem onClick={() => window.open(`tel:${contact.phone}`)}>
                                <Phone className="w-3.5 h-3.5 mr-2" />Call
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              const confirmed = await confirm({
                                title: 'Delete contact?',
                                description: 'This removes the contact and clears linked deals and activity records.',
                                confirmLabel: 'Delete contact',
                                destructive: true,
                              });
                              if (confirmed) deleteMutation.mutate(contact.id);
                            }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={filtered.length} onPageChange={setPage} label="contacts" />
        </div>
      )}

      <ContactFormDialog open={dialogOpen} onOpenChange={setDialogOpen} contact={editContact} isSaving={createMutation.isPending || updateMutation.isPending} onSave={handleSave} />
    </div>
  );
}
