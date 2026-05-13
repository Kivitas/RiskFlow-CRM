import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import { Plus, TrendingUp, MoreHorizontal, Pencil, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import DealFormDialog from '@/Components/deals/DealFromDialog';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { generateDealInvoicePdf } from '@/lib/invoices';

const stageConfig = {
  discovery: { label: 'Discovery', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  proposal: { label: 'Proposal', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  negotiation: { label: 'Negotiation', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed_won: { label: 'Won', color: 'bg-green-50 text-green-700 border-green-200' },
  closed_lost: { label: 'Lost', color: 'bg-red-50 text-red-700 border-red-200' },
};

const priorityColors = {
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  high: 'bg-red-50 text-red-600 border-red-200',
};

export default function Deals() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDeal, setEditDeal] = useState(null);
  const [viewMode, setViewMode] = useState('board');
  const qc = useQueryClient();
  const { profile } = useBusiness();
  const { formatMoney, currencyInfo, convertAmount } = useCurrency();
  const confirm = useConfirm();

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => crmClient.entities.Deal.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => crmClient.entities.Deal.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => crmClient.entities.Deal.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setDialogOpen(false); setEditDeal(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => crmClient.entities.Deal.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });

  const handleDeleteDeal = async (deal) => {
    const confirmed = await confirm({
      title: 'Delete deal?',
      description: `Delete ${deal.title} from the pipeline.`,
      confirmLabel: 'Delete deal',
      destructive: true,
    });
    if (confirmed) {
      deleteMutation.mutate(deal.id);
    }
  };

  const handleSave = (data) => {
    if (editDeal) updateMutation.mutate({ id: editDeal.id, data });
    else createMutation.mutate(data);
  };

  const handleInvoice = (deal) => {
    generateDealInvoicePdf({ profile, deal, currencyInfo, convertAmount });
  };

  const stages = ['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div>
      <PageHeader
        title="Deals Pipeline"
        subtitle={`${deals.length} deals | ${formatMoney(totalValue)} total value`}
        actions={
          <div className="flex gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('board')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === 'board' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}
              >Board</button>
              <button
                onClick={() => setViewMode('list')}
                className={cn("px-3 py-1.5 rounded-md text-xs font-medium transition-all", viewMode === 'list' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground')}
              >List</button>
            </div>
            <Button onClick={() => { setEditDeal(null); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />Add Deal
            </Button>
          </div>
        }
      />

      {deals.length === 0 && !isLoading ? (
        <EmptyState icon={TrendingUp} title="No deals yet" description="Create your first deal to start tracking your pipeline." actionLabel="Add Deal" onAction={() => setDialogOpen(true)} />
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {stages.map(stage => {
            const stageDeals = deals.filter(d => d.stage === stage);
            const stageTotal = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
            return (
              <div key={stage} className="bg-muted/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">{stageConfig[stage].label}</h3>
                    <p className="text-[11px] text-muted-foreground">{stageDeals.length} deals | {formatMoney(stageTotal)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {stageDeals.map(deal => (
                    <div key={deal.id} className="bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow cursor-pointer group">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-card-foreground">{deal.title}</p>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditDeal(deal); setDialogOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleInvoice(deal)}>
                              <FileText className="w-3.5 h-3.5 mr-2" />Invoice PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteDeal(deal)}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="text-lg font-bold text-card-foreground mt-1">{formatMoney(deal.value)}</p>
                      {deal.contact_name && <p className="text-xs text-muted-foreground mt-1">{deal.contact_name}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={cn("text-[10px]", priorityColors[deal.priority])}>{deal.priority}</Badge>
                        <span className="text-[10px] text-muted-foreground">{deal.probability}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Deal</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Value</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Stage</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Priority</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Close Date</th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => (
                <tr key={deal.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-card-foreground">{deal.title}</p>
                    {deal.contact_name && <p className="text-xs text-muted-foreground">{deal.contact_name}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-card-foreground">{formatMoney(deal.value)}</td>
                  <td className="px-4 py-3"><Badge variant="outline" className={cn("text-xs", stageConfig[deal.stage]?.color)}>{stageConfig[deal.stage]?.label}</Badge></td>
                  <td className="px-4 py-3"><Badge variant="outline" className={cn("text-xs capitalize", priorityColors[deal.priority])}>{deal.priority}</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {deal.expected_close_date ? format(new Date(deal.expected_close_date), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditDeal(deal); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleInvoice(deal)}>
                          <FileText className="w-3.5 h-3.5 mr-2" />Invoice PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteDeal(deal)}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DealFormDialog open={dialogOpen} onOpenChange={setDialogOpen} deal={editDeal} onSave={handleSave} />
    </div>
  );
}
