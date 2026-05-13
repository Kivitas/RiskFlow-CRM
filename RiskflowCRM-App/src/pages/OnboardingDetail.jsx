import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, FileText, Trash2, Download, CheckCircle2,
  Clock, Pencil, ChevronRight, File,
  FileImage, FileSpreadsheet, User, Mail, Phone, Calendar,
  DollarSign, Globe, Shield, StickyNote, Loader2, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import OnboardingFormDialog from '@/components/onboarding/OnboardingFormDialog';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';

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
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  in_review: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  high: 'bg-red-100 text-red-700 border-red-200',
};

const DOC_CATEGORIES = [
  'Government ID', 'Passport', 'Proof of Address', 'Bank Statement',
  'Tax Return', 'Source of Funds', 'Corporate Docs', 'Other'
];

const safeParse = (d) => { try { return parseISO(d); } catch { return new Date(); } };

function getFileIcon(type) {
  if (!type) return File;
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return FileSpreadsheet;
  return FileText;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function OnboardingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef();
  const { formatMoney } = useCurrency();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('Other');
  const [dragOver, setDragOver] = useState(false);

  const { data: client, isLoading } = useQuery({
    queryKey: ['onboarding-client', id],
    queryFn: async () => {
      const all = await crmClient.entities.OnboardingClient.list();
      return all.find(c => c.id === id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => crmClient.entities.OnboardingClient.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['onboarding-client', id] });
      qc.invalidateQueries({ queryKey: ['onboarding'] });
      setEditOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => crmClient.entities.OnboardingClient.delete(id),
    onSuccess: () => navigate('/onboarding'),
  });

  const handleUploadFile = async (file) => {
    if (!file || !client) return;
    setUploading(true);
    try {
      const { fileUrl } = await crmClient.files.upload(file);
      const newFile = {
        name: file.name,
        url: fileUrl,
        type: file.type,
        size: file.size,
        uploaded_at: new Date().toISOString(),
        category: uploadCategory,
      };
      const existingFiles = client.uploaded_files || [];
      const updatedFiles = [...existingFiles, newFile];
      await updateMutation.mutateAsync({
        ...client,
        uploaded_files: updatedFiles,
        documents_uploaded: updatedFiles.length,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  };

  const handleDeleteFile = async (fileUrl) => {
    if (!client) return;
    const updatedFiles = (client.uploaded_files || []).filter(f => f.url !== fileUrl);
    updateMutation.mutate({
      ...client,
      uploaded_files: updatedFiles,
      documents_uploaded: updatedFiles.length,
    });
  };

  const handleAdvanceStage = () => {
    if (!client) return;
    const idx = stageOrder.indexOf(client.onboarding_stage);
    const next = stageOrder[idx + 1];
    if (next) updateMutation.mutate({ ...client, onboarding_stage: next });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );
  if (!client) return <div className="text-center py-20 text-muted-foreground">Client not found.</div>;

  const stageIndex = stageOrder.indexOf(client.onboarding_stage);
  const overallProgress = Math.round(((stageIndex + 1) / stageOrder.length) * 100);
  const uploadedFiles = client.uploaded_files || [];
  const docProgress = client.documents_required > 0 ? Math.min(100, Math.round((uploadedFiles.length / client.documents_required) * 100)) : 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Link to="/onboarding" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Onboarding
        </Link>
        <div className="flex gap-2">
          {client.onboarding_stage !== 'completed' && (
            <Button size="sm" variant="outline" onClick={handleAdvanceStage} disabled={updateMutation.isPending}>
              <ChevronRight className="w-4 h-4 mr-1" />Advance Stage
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1" />Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={async () => {
            const confirmed = await confirm({
              title: 'Delete onboarding client?',
              description: 'This permanently removes the client and their onboarding progress.',
              confirmLabel: 'Delete client',
              destructive: true,
            });
            if (confirmed) deleteMutation.mutate();
          }}>
            <Trash2 className="w-4 h-4 mr-1" />Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LEFT COL */}
        <div className="space-y-4">
          {/* Profile */}
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary flex-shrink-0">
                {client.client_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-lg font-bold text-card-foreground">{client.client_name}</h1>
                <p className="text-sm text-muted-foreground">{client.company || 'Individual'}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
              <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/20">{stageLabels[client.onboarding_stage]}</Badge>
              <Badge variant="outline" className={cn("text-[11px]", kycColors[client.kyc_status])}>KYC: {client.kyc_status?.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline" className={cn("text-[11px]", priorityColors[client.priority])}>{client.priority} priority</Badge>
            </div>

            <div className="space-y-3 text-sm">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 flex-shrink-0"><Mail className="w-3.5 h-3.5" /></div>
                  <span className="truncate">{client.email}</span>
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors group">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 flex-shrink-0"><Phone className="w-3.5 h-3.5" /></div>
                  <span>{client.phone}</span>
                </a>
              )}
              {client.assigned_to && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><User className="w-3.5 h-3.5" /></div>
                  <span>Assigned to {client.assigned_to}</span>
                </div>
              )}
              {client.nationality && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Globe className="w-3.5 h-3.5" /></div>
                  <span>{client.nationality}</span>
                </div>
              )}
              {client.date_of_birth && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Calendar className="w-3.5 h-3.5" /></div>
                  <span>DOB: {format(safeParse(client.date_of_birth), 'MMM d, yyyy')}</span>
                </div>
              )}
              {client.id_number && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Shield className="w-3.5 h-3.5" /></div>
                  <span>ID: {client.id_number}</span>
                </div>
              )}
              {client.target_completion_date && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><Clock className="w-3.5 h-3.5" /></div>
                  <span>Target: {format(safeParse(client.target_completion_date), 'MMM d, yyyy')}</span>
                </div>
              )}
            </div>

            {client.notes && (
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" />Notes</p>
                <p className="text-sm text-card-foreground leading-relaxed">{client.notes}</p>
              </div>
            )}
          </div>

          {/* Financial Profile */}
          {(client.investment_amount || client.source_of_funds || client.risk_profile) && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Financial Profile</h3>
              <div className="space-y-3">
                {client.investment_amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="w-3.5 h-3.5" />Investment Amount</span>
                    {/* Bug fix: was raw $toLocaleString, now uses formatMoney for currency conversion */}
                    <span className="text-sm font-bold text-card-foreground">{formatMoney(client.investment_amount)}</span>
                  </div>
                )}
                {client.risk_profile && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Risk Profile</span>
                    <span className="text-sm font-semibold text-card-foreground capitalize">{client.risk_profile}</span>
                  </div>
                )}
                {client.source_of_funds && (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-1">Source of Funds</span>
                    <span className="text-sm text-card-foreground">{client.source_of_funds}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COL */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stage Progress */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-card-foreground">Onboarding Progress</h3>
              <span className="text-sm font-bold text-primary">{overallProgress}%</span>
            </div>
            <div className="flex items-center gap-0 mb-4 overflow-x-auto pb-1">
              {stageOrder.map((stage, i) => {
                const isDone = stageIndex > i;
                const isCurrent = stageIndex === i;
                return (
                  <React.Fragment key={stage}>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                        isDone ? "bg-accent border-accent text-white" :
                        isCurrent ? "bg-primary border-primary text-white" :
                        "bg-background border-border text-muted-foreground"
                      )}>
                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                      <span className={cn("text-[9px] mt-1.5 font-medium text-center max-w-[60px] leading-tight",
                        isCurrent ? "text-primary" : isDone ? "text-accent" : "text-muted-foreground"
                      )}>{stageLabels[stage]}</span>
                    </div>
                    {i < stageOrder.length - 1 && (
                      <div className={cn("flex-1 h-0.5 mx-1 min-w-[16px]", isDone ? "bg-accent" : "bg-border")} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Document Upload */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Documents</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {uploadedFiles.length} of {client.documents_required || 5} required documents uploaded
                </p>
              </div>
              <span className="text-sm font-bold text-card-foreground">{docProgress}%</span>
            </div>
            <Progress value={docProgress} className="h-2 mb-5" />

            <div className="mb-4">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">Document Category</label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {DOC_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setUploadCategory(cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                      uploadCategory === cat
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-transparent hover:border-border"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all",
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
                onClick={() => !uploading && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.ods,.csv" />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading document...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-card-foreground">Drop file here or click to upload</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG, PNG, Word, ODS, CSV - as <span className="font-semibold text-primary">{uploadCategory}</span></p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {uploadedFiles.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Uploaded Files</p>
                {uploadedFiles.map((file, i) => {
                  const Icon = getFileIcon(file.type);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors group">
                      <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
                        <Icon className="w-[18px] h-[18px] text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{file.category || 'Other'}</span>
                          {file.size && <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>}
                          {file.uploaded_at && <span className="text-[10px] text-muted-foreground">{format(safeParse(file.uploaded_at), 'MMM d, yyyy')}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="w-3.5 h-3.5" /></Button>
                        </a>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFile(file.url)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-sm text-muted-foreground">No documents uploaded yet.</div>
            )}
          </div>
        </div>
      </div>

      <OnboardingFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        client={client}
        onSave={(data) => updateMutation.mutate(data)}
      />
    </div>
  );
}
