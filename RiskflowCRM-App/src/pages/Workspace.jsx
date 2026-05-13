import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  AlertTriangle, Bell, Building2, Download, LockKeyhole,
  Plus, ShieldCheck, Upload, CheckCircle, XCircle,
} from 'lucide-react';
import UserFormDialog from '@/Components/workspace/UserFormDialog';
import WarehouseFormDialog from '@/Components/workspace/WarehouseFormDialog';
import StockAdjustmentDialog from '@/Components/workspace/StockAdjustmentDialog';
import { useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useAuth } from '@/lib/AuthContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { toast } from '@/components/ui/use-toast';

const tabs = ['Team', 'Approvals', 'Warehouses', 'Activity', 'Backup'];

const statusBadge = (status) =>
  cn(
    'text-[10px] capitalize',
    status === 'approved' || status === 'active' || status === 'received'
      ? 'bg-green-50 text-green-700 border-green-200'
      : status === 'pending'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : status === 'rejected' || status === 'inactive'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-slate-50 text-slate-600 border-slate-200'
  );

const safeFmt = (d) => { try { return d ? format(new Date(d), 'dd MMM yyyy, hh:mm a') : '-'; } catch { return '-'; } };

export default function Workspace() {
  const qc = useQueryClient();
  const { profile } = useBusiness();
  const { user } = useAuth();
  const { formatMoney } = useCurrency();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('Team');
  const [search, setSearch] = useState('');
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [warehouseDialogOpen, setWarehouseDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [notifSearch, setNotifSearch] = useState('');

  const { data: appUsers = [] } = useQuery({ queryKey: ['app-users'], queryFn: () => crmClient.users.list() });
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: () => crmClient.approvals.list() });
  const { data: warehouses = [] } = useQuery({ queryKey: ['warehouses'], queryFn: () => crmClient.warehouses.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => crmClient.products.list() });
  const { data: adjustments = [] } = useQuery({ queryKey: ['stock-adjustments'], queryFn: () => crmClient.stockAdjustments.list() });
  const { data: notifications = [] } = useQuery({ queryKey: ['notifications'], queryFn: () => crmClient.notifications.list() });
  const { data: auditLogs = [] } = useQuery({ queryKey: ['audit'], queryFn: () => crmClient.audit.list() });

  const userMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.users.update(id, data) : crmClient.users.create(data)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app-users'] }); setUserDialogOpen(false); setEditingUser(null); },
    onError: (error) => toast({ title: 'User update failed', description: error.message, variant: 'destructive' }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => crmClient.users.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-users'] }),
    onError: (error) => toast({ title: 'User deletion failed', description: error.message, variant: 'destructive' }),
  });

  const warehouseMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.warehouses.update(id, data) : crmClient.warehouses.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setWarehouseDialogOpen(false);
      setEditingWarehouse(null);
    },
    onError: (error) => toast({ title: 'Warehouse update failed', description: error.message, variant: 'destructive' }),
  });

  const deleteWarehouseMutation = useMutation({
    mutationFn: (id) => crmClient.warehouses.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['warehouses'] }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError: (error) => toast({ title: 'Warehouse deletion failed', description: error.message, variant: 'destructive' }),
  });

  const adjustmentMutation = useMutation({
    mutationFn: (data) => crmClient.stockAdjustments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
      setAdjustmentDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Stock adjustment failed', description: error.message, variant: 'destructive' }),
  });

  const approvalMutation = useMutation({
    mutationFn: ({ id, decision }) => crmClient.approvals.decide(id, decision),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => crmClient.notifications.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const filteredUsers = useMemo(
    () => appUsers.filter((u) => `${u.full_name} ${u.email} ${u.role}`.toLowerCase().includes(search.toLowerCase())),
    [appUsers, search]
  );

  const filteredNotifs = useMemo(
    () => notifications.filter((n) =>
      !notifSearch || `${n.title} ${n.message}`.toLowerCase().includes(notifSearch.toLowerCase())
    ),
    [notifications, notifSearch]
  );

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const handleExport = async () => {
    const snapshot = await crmClient.backups.exportAll();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.companyName || 'workspace'}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      await crmClient.backups.importAll(snapshot);
      await qc.invalidateQueries();
      toast({ title: 'Backup imported', description: 'Workspace data was restored successfully.' });
    } catch (error) {
      toast({ title: 'Backup import failed', description: error.message || 'Failed to import backup file.', variant: 'destructive' });
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div>
      <PageHeader
        title="Workspace Control"
        subtitle={`${profile.companyName || 'Your business'} admin console for access, approvals, stock governance, and backup management`}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Team Members', value: appUsers.length, sub: `${appUsers.filter(u => u.status === 'active').length} active accounts` },
          { label: 'Open Approvals', value: pendingApprovals.length, sub: 'Quotes, purchases, and expenses awaiting review', highlight: pendingApprovals.length > 0 ? 'text-amber-600' : undefined },
          { label: 'Warehouses', value: warehouses.length, sub: `${products.length} products across locations` },
          { label: 'Unread Alerts', value: unreadNotifs, sub: 'System notifications for the signed-in role', highlight: unreadNotifs > 0 ? 'text-blue-600' : undefined },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
            <p className={cn('text-3xl font-bold', highlight || 'text-card-foreground')}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-5 w-fit flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative',
              activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab}
            {tab === 'Approvals' && pendingApprovals.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingApprovals.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* TEAM */}
      {activeTab === 'Team' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Users and Roles</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Separate logins, permissions, and status control for each team member</p>
            </div>
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team..." className="w-56" />
              <Button onClick={() => { setEditingUser(null); setUserDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />Add User
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['User', 'Role', 'Status', 'Access', 'Actions'].map(h => (
                    <th key={h} className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3', h === 'Actions' ? 'text-right' : 'text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((teamUser) => (
                  <tr key={teamUser.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">{(teamUser.full_name || '?')[0]?.toUpperCase()}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-card-foreground">{teamUser.full_name}</p>
                          <p className="text-xs text-muted-foreground">{teamUser.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-card-foreground">{teamUser.role}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadge(teamUser.status)}>{teamUser.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {teamUser.role === 'admin' ? 'Full access' : `${teamUser.role} module policy`}
                      <span className="block mt-1">{teamUser.ai_enabled !== false ? 'AI enabled' : 'AI disabled'}</span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingUser(teamUser); setUserDialogOpen(true); }}>Edit</Button>
                      {teamUser.id !== user?.id && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                          const confirmed = await confirm({
                            title: 'Delete user?',
                            description: `Remove ${teamUser.full_name} from the workspace. This action cannot be undone.`,
                            confirmLabel: 'Delete user',
                            destructive: true,
                          });
                          if (confirmed) deleteUserMutation.mutate(teamUser.id);
                        }}>Delete</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-sm text-muted-foreground text-center">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPROVALS */}
      {activeTab === 'Approvals' && (
        <div className="grid lg:grid-cols-[1.3fr_0.7fr] gap-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">Approval Queue</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Threshold-based approvals for quotes, purchases, and expenses</p>
            </div>
            <div className="divide-y divide-border">
              {approvals.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground text-center">No approval requests yet.</div>
              )}
              {approvals.map((approval) => (
                <div key={approval.id} className="p-4 flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-card-foreground">{approval.title}</p>
                      <Badge variant="outline" className={statusBadge(approval.status)}>{approval.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {approval.entity_type} |{' '}
                      Amount: <span className="font-semibold text-foreground">{formatMoney(approval.amount)}</span> |{' '}
                      Threshold: <span className="font-semibold">{formatMoney(approval.threshold)}</span>
                    </p>
                    {approval.status !== 'pending' && approval.decided_by_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {approval.status === 'approved' ? 'Approved by' : 'Rejected by'} {approval.decided_by_name}
                        {approval.decision_note ? ` - ${approval.decision_note}` : ''}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">{safeFmt(approval.created_date)}</p>
                  </div>
                  {approval.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => approvalMutation.mutate({ id: approval.id, decision: 'approved' })}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/5"
                        onClick={() => approvalMutation.mutate({ id: approval.id, decision: 'rejected' })}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Role Alerts</h3>
                <div className="ml-auto">
                  <Input
                    value={notifSearch}
                    onChange={(e) => setNotifSearch(e.target.value)}
                    placeholder="Filter..."
                    className="h-7 text-xs w-32"
                  />
                </div>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {filteredNotifs.slice(0, 10).map((n) => (
                  <div
                    key={n.id}
                    className={cn('rounded-xl border border-border p-3 cursor-pointer transition-colors', !n.read && 'border-primary/30 bg-primary/5')}
                    onClick={() => !n.read && markReadMutation.mutate(n.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn('text-sm font-semibold text-card-foreground', !n.read && 'text-primary')}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                  </div>
                ))}
                {filteredNotifs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No notifications.</p>}
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <LockKeyhole className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Policy Snapshot</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>Quote approvals above <span className="font-medium text-foreground">{formatMoney(profile.quoteApprovalThreshold)}</span></p>
                <p>Purchase approvals above <span className="font-medium text-foreground">{formatMoney(profile.purchaseApprovalThreshold)}</span></p>
                <p>Expense approvals above <span className="font-medium text-foreground">{formatMoney(profile.expenseApprovalThreshold)}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WAREHOUSES ── */}
      {activeTab === 'Warehouses' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setEditingWarehouse(null); setWarehouseDialogOpen(true); }}>
              <Building2 className="w-4 h-4 mr-2" />Add Warehouse
            </Button>
            <Button onClick={() => setAdjustmentDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Stock Adjustment
            </Button>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Warehouse Directory</h3>
              </div>
              <div className="divide-y divide-border">
                {warehouses.map((wh) => (
                  <div key={wh.id} className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{wh.name}</p>
                      <p className="text-xs text-muted-foreground">{wh.code} | {wh.location || 'No location set'}</p>
                      {wh.manager_name && <p className="text-xs text-muted-foreground">Manager: {wh.manager_name}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusBadge(wh.status)}>{wh.status}</Badge>
                      <Button variant="outline" size="sm" onClick={() => { setEditingWarehouse(wh); setWarehouseDialogOpen(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                        const confirmed = await confirm({
                          title: 'Delete warehouse?',
                          description: `Delete ${wh.name}. Make sure no products remain assigned to it first.`,
                          confirmLabel: 'Delete warehouse',
                          destructive: true,
                        });
                        if (confirmed) deleteWarehouseMutation.mutate(wh.id);
                      }}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Recent Stock Adjustments</h3>
              </div>
              <div className="divide-y divide-border">
                {adjustments.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground text-center">No stock adjustments yet.</div>
                )}
                {adjustments.slice(0, 10).map((adj) => (
                  <div key={adj.id} className="p-4 flex items-center gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold',
                      adj.quantity > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                      {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{adj.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {adj.reason} | {adj.adjustment_date ? format(new Date(adj.adjustment_date), 'dd MMM yyyy') : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === 'Activity' && (
        <div className="grid lg:grid-cols-[1.25fr_0.75fr] gap-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">Audit Trail</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Complete record of who changed what and when</p>
            </div>
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
              {auditLogs.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground text-center">No activity yet.</div>
              )}
              {auditLogs.slice(0, 100).map((log) => (
                <div key={log.id} className="p-4 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground">{(log.actor_name || '?')[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">
                      {log.actor_name} <span className="font-normal text-muted-foreground">{log.action.replace(/_/g, ' ')}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.entity_type} | {log.entity_label || log.entity_id} | {safeFmt(log.created_date)}
                    </p>
                    {log.details && <p className="text-xs text-muted-foreground mt-0.5 italic">{log.details}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Security Signals</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{appUsers.filter(u => u.status === 'inactive').length} inactive users on record</p>
                <p>{notifications.filter(n => n.type === 'warning' && !n.read).length} unread warning alerts</p>
                <p>{pendingApprovals.length} pending approvals can block workflow</p>
                <p>{auditLogs.filter(l => l.action === 'login').length} login events recorded</p>
              </div>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Operational Notes</h3>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Every create/update/delete action writes to the audit log.</p>
                <p>Approvals are triggered automatically from the thresholds in Settings.</p>
                <p>Stock adjustments write separate governance records outside sales and purchases.</p>
                <p>Notifications are role-filtered. Admins see all, users see their own.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BACKUP ── */}
      {activeTab === 'Backup' && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">Export Workspace Backup</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Download all records, settings, users, approvals, and activity history as one JSON backup file.
            </p>
            <Button onClick={handleExport}><Download className="w-4 h-4 mr-2" />Download Backup</Button>
          </div>
          <div className="bg-card rounded-xl border border-border p-6">
            <div className="flex items-center gap-2 mb-3">
              <Upload className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-card-foreground">Import Workspace Backup</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Restore a previously exported backup file into this workspace. <strong className="text-destructive">This will overwrite all current data.</strong>
            </p>
            <label className="inline-flex cursor-pointer">
              <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
                <Upload className="w-4 h-4" />Choose Backup File
              </span>
            </label>
          </div>
        </div>
      )}

      <UserFormDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={editingUser}
        onSave={(data) => userMutation.mutate({ id: editingUser?.id, data })}
      />
      <WarehouseFormDialog
        open={warehouseDialogOpen}
        onOpenChange={setWarehouseDialogOpen}
        warehouse={editingWarehouse}
        onSave={(data) => warehouseMutation.mutate({ id: editingWarehouse?.id, data })}
      />
      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        products={products}
        onSave={(data) => adjustmentMutation.mutate(data)}
      />
    </div>
  );
}
