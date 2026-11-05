import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, UserPlus, MoreHorizontal, Pencil, Trash2, CheckCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import OnboardingFormDialog from '@/components/onboarding/OnboardingFormDialog';
import { cn } from '@/lib/utils';
import { format, isValid, parseISO } from 'date-fns';

const stageOrder = ['intake', 'kyc_verification', 'risk_profiling', 'document_collection', 'account_setup', 'completed'];
const stageLabels = {
  intake: 'Intake',
  kyc_verification: 'KYC Verification',
  risk_profiling: 'Risk Profiling',
  document_collection: 'Document Collection',
  account_setup: 'Account Setup',
  completed: 'Completed',
};

const kycColors = {
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  in_review: 'bg-amber-50 text-amber-600 border-amber-200',
  approved: 'bg-green-50 text-green-600 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

const priorityColors = {
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  high: 'bg-red-50 text-red-600 border-red-200',
};

// parseISO never throws (it returns an Invalid Date) and format() throws on that, so guard both.
const formatDate = (value, pattern) => {
  if (!value) return '-';
  const date = parseISO(String(value));
  return isValid(date) ? format(date, pattern) : '-';
};

export default function Onboarding() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => crmClient.entities.OnboardingClient.list('-created_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => crmClient.entities.OnboardingClient.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setDialogOpen(false); },
    onError: (e) => toast({ title: 'Client save failed', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => crmClient.entities.OnboardingClient.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding'] }); setDialogOpen(false); setEditClient(null); },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => crmClient.entities.OnboardingClient.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['onboarding'] }),
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const handleSave = (data) => {
    if (editClient) updateMutation.mutate({ id: editClient.id, data });
    else createMutation.mutate(data);
  };

  const completedCount = clients.filter(c => c.onboarding_stage === 'completed').length;
  const activeCount = clients.filter(c => c.onboarding_stage !== 'completed').length;

  return (
    <div>
      <PageHeader
        title="Client Onboarding"
        subtitle={`${activeCount} in progress | ${completedCount} completed`}
        actions={
          <Button onClick={() => { setEditClient(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />New Client
          </Button>
        }
      />

      {/* Stage overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {stageOrder.map(stage => {
          const count = clients.filter(c => c.onboarding_stage === stage).length;
          const isCompleted = stage === 'completed';
          return (
            <div key={stage} className={cn(
              "bg-card rounded-xl border border-border p-3 text-center",
              isCompleted && count > 0 && "border-accent/30 bg-accent/5"
            )}>
              <p className="text-xl font-bold text-card-foreground">{count}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{stageLabels[stage]}</p>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading onboarding clients">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState icon={UserPlus} title="No onboarding clients" description="Start onboarding a new client to track their progress." actionLabel="Add Client" onAction={() => setDialogOpen(true)} />
      ) : (
        <div className="space-y-3">
          {clients.map(client => {
            const stageIndex = stageOrder.indexOf(client.onboarding_stage);
            const progress = ((stageIndex + 1) / stageOrder.length) * 100;
            // Same fallback as the "x/N" label below, so the bar and the label always agree.
            const requiredDocs = client.documents_required || 5;
            const docProgress = Math.min(100, ((client.documents_uploaded || 0) / requiredDocs) * 100);

            return (
              <div key={client.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-lg transition-shadow group cursor-pointer" onClick={() => navigate(`/onboarding/${client.id}`)}>
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">{client.client_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-card-foreground">
                          <Link
                            to={`/onboarding/${client.id}`}
                            onClick={e => e.stopPropagation()}
                            className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {client.client_name}
                          </Link>
                        </h3>
                        <p className="text-xs text-muted-foreground">{client.company || client.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">{stageLabels[client.onboarding_stage]}</Badge>
                      <Badge variant="outline" className={cn("text-[10px]", kycColors[client.kyc_status])}>KYC: {client.kyc_status?.replace(/_/g, ' ')}</Badge>
                      <Badge variant="outline" className={cn("text-[10px]", priorityColors[client.priority])}>{client.priority}</Badge>
                      {client.assigned_to && <span className="text-[10px] text-muted-foreground">Assigned: {client.assigned_to}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-6 lg:w-[320px]">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Onboarding</span>
                        <span className="font-semibold text-card-foreground">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> Docs</span>
                        <span className="font-semibold text-card-foreground">{client.documents_uploaded || 0}/{requiredDocs}</span>
                      </div>
                      <Progress value={docProgress} className="h-1.5" />
                    </div>

                    {client.target_completion_date && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-muted-foreground">Target</p>
                        <p className="text-xs font-semibold text-card-foreground">{formatDate(client.target_completion_date, 'MMM d')}</p>
                      </div>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${client.client_name}`} className="h-8 w-8 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/onboarding/${client.id}`); }}>
                          <FileText className="w-3.5 h-3.5 mr-2" />View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditClient(client); setDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                        </DropdownMenuItem>
                        {client.onboarding_stage !== 'completed' && (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            const nextStage = stageOrder[stageIndex + 1];
                            if (nextStage) updateMutation.mutate({ id: client.id, data: { ...client, onboarding_stage: nextStage } });
                          }}>
                            <CheckCircle className="w-3.5 h-3.5 mr-2" />Advance Stage
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(client.id); }}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OnboardingFormDialog open={dialogOpen} onOpenChange={setDialogOpen} client={editClient} isSaving={createMutation.isPending || updateMutation.isPending} onSave={handleSave} />
    </div>
  );
}
