import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import { Plus, ShieldAlert, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import RiskFormDialog from '@/components/risk/RiskFormDialog';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/lib/ConfirmContext';

const severityConfig = {
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', bar: 'bg-red-500' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200', bar: 'bg-orange-500' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-500' },
  low: { label: 'Low', color: 'bg-green-100 text-green-700 border-green-200', bar: 'bg-green-500' },
};

const statusConfig = {
  identified: { label: 'Identified', color: 'bg-slate-50 text-slate-600 border-slate-200' },
  analyzing: { label: 'Analyzing', color: 'bg-blue-50 text-blue-600 border-blue-200' },
  mitigating: { label: 'Mitigating', color: 'bg-amber-50 text-amber-600 border-amber-200' },
  resolved: { label: 'Resolved', color: 'bg-green-50 text-green-600 border-green-200' },
  accepted: { label: 'Accepted', color: 'bg-purple-50 text-purple-600 border-purple-200' },
};

export default function RiskManagement() {
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRisk, setEditRisk] = useState(null);
  const [catFilter, setCatFilter] = useState('all');
  const [sevFilter, setSevFilter] = useState('all');
  const qc = useQueryClient();

  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['risks'],
    queryFn: () => crmClient.entities.RiskAssessment.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => crmClient.entities.RiskAssessment.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risks'] }); setDialogOpen(false); },
    onError: (e) => toast({ title: 'Risk save failed', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => crmClient.entities.RiskAssessment.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['risks'] }); setDialogOpen(false); setEditRisk(null); },
    onError: (e) => toast({ title: 'Risk save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => crmClient.entities.RiskAssessment.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks'] }),
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const handleSave = (data) => {
    if (editRisk) updateMutation.mutate({ id: editRisk.id, data });
    else createMutation.mutate(data);
  };

  const filtered = risks.filter(r => {
    return (catFilter === 'all' || r.category === catFilter) && (sevFilter === 'all' || r.severity === sevFilter);
  });

  return (
    <div>
      <PageHeader
        title="Risk Management"
        subtitle={`${risks.length} risks tracked · ${risks.filter(r => r.severity === 'critical').length} critical`}
        actions={
          <Button onClick={() => { setEditRisk(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Risk
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="credit">Credit</SelectItem>
            <SelectItem value="market">Market</SelectItem>
            <SelectItem value="operational">Operational</SelectItem>
            <SelectItem value="liquidity">Liquidity</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="strategic">Strategic</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sevFilter} onValueChange={setSevFilter}>
          <SelectTrigger className="w-full sm:w-[160px]" aria-label="Filter by severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading risks">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No risks found" description="Start tracking financial risks by adding your first assessment." actionLabel="Add Risk" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(risk => (
            <div key={risk.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-card-foreground">{risk.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{risk.category} Risk</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Actions for ${risk.title}`} className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditRisk(risk); setDialogOpen(true); }}>
                      <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={async () => {
                      const confirmed = await confirm({
                        title: 'Delete risk?',
                        description: `Delete "${risk.title}" from the risk register.`,
                        confirmLabel: 'Delete risk',
                        destructive: true,
                      });
                      if (confirmed) deleteMutation.mutate(risk.id);
                    }}>
                      <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={cn("text-[10px]", severityConfig[risk.severity]?.color)}>
                  {severityConfig[risk.severity]?.label}
                </Badge>
                <Badge variant="outline" className={cn("text-[10px]", statusConfig[risk.status]?.color)}>
                  {statusConfig[risk.status]?.label}
                </Badge>
              </div>

              {risk.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{risk.description}</p>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Impact Score</span>
                  <span className="font-semibold text-card-foreground">{risk.impact_score ?? 0}/10</span>
                </div>
                <Progress value={(risk.impact_score || 0) * 10} className="h-1.5" />
              </div>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                {risk.owner && <span className="text-xs text-muted-foreground">Owner: {risk.owner}</span>}
                <span className="text-[10px] text-muted-foreground capitalize">{risk.likelihood?.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <RiskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} risk={editRisk} isSaving={createMutation.isPending || updateMutation.isPending} onSave={handleSave} />
    </div>
  );
}
