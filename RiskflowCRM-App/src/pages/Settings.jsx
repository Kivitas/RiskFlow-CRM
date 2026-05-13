import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  Bell,
  Building2,
  Download,
  Globe,
  Hash,
  Info,
  KeyRound,
  LockKeyhole,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { crmClient } from '@/api/crmClient';
import { useAuth } from '@/lib/AuthContext';
import { useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import { getAiProviderConfig } from '@/lib/aiClient';
import PageHeader from '@/components/shared/PageHeader';
import CurrencySelector from '@/Components/shared/CurrencySelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

const TABS = ['Business Profile', 'Currency', 'Numbering', 'Approvals', 'Notifications', 'AI Assistant', 'Data'];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

export default function Settings() {
  const { profile, saveProfile, clearPassword } = useBusiness();
  const { user, checkUserAuth } = useAuth();
  const confirm = useConfirm();
  const { currencyInfo, ratesSource, convertAmount, toBaseAmount, formatMoney } = useCurrency();
  const [form, setForm] = useState(profile);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('Business Profile');
  const [exportMsg, setExportMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [secureErasePasses, setSecureErasePasses] = useState('3');
  const activeAiProvider = getAiProviderConfig(form);

  useEffect(() => {
    setForm({
      ...profile,
      adminPassword: '',
    });
  }, [profile]);

  const handleLogoChange = async (event) => {
    const dataUrl = await readFileAsDataUrl(event.target.files?.[0]);
    setForm((current) => ({ ...current, logoDataUrl: dataUrl }));
  };

  const showSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      if (user?.role === 'admin') {
        if (!String(form.adminName || '').trim()) {
          throw new Error('Admin name is required');
        }
        if (!String(form.adminEmail || '').trim()) {
          throw new Error('Admin email is required');
        }
        await crmClient.users.update(user.id, {
          full_name: form.adminName || user.full_name,
          email: form.adminEmail || user.email,
          ...(form.adminPassword ? { password: form.adminPassword } : {}),
        });
        await checkUserAuth();
      }
      saveProfile({
        ...form,
        adminName: String(form.adminName || '').trim(),
        adminEmail: String(form.adminEmail || '').trim().toLowerCase(),
        adminPassword: form.adminPassword || profile.adminPassword,
      });
      showSaved();
    } catch (error) {
      toast({ title: 'Save failed', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    const snapshot = await crmClient.backups.exportAll();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${profile.companyName || 'riskflow'}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportMsg('Backup downloaded');
    toast({ title: 'Backup downloaded', description: 'A fresh workspace backup was exported.' });
    window.setTimeout(() => setExportMsg(''), 2000);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const snapshot = JSON.parse(await file.text());
      await crmClient.backups.importAll(snapshot);
      window.location.reload();
    } catch (error) {
      toast({ title: 'Import failed', description: error.message || 'Failed to import backup', variant: 'destructive' });
    }
  };

  const handleClearData = async () => {
    const confirmed = await confirm({
      title: 'Clear operational data?',
      description: 'This deletes workspace records and keeps only your profile settings and branding.',
      confirmLabel: 'Clear data',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    await crmClient.backups.clearOperationalData();
    window.location.reload();
  };

  const handleSecureErase = async () => {
    const confirmed = await confirm({
      title: 'Run secure erase?',
      description: `This will overwrite local workspace storage ${secureErasePasses} times with phantom data and then permanently remove everything, including business settings, logins, AI keys, and branding.`,
      confirmLabel: 'Secure erase now',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    await crmClient.backups.secureErase({ passes: Number(secureErasePasses) });
    window.location.reload();
  };

  return (
    <div>
      <PageHeader
        title="Business Settings"
        subtitle="Branding, numbering, approval thresholds, currency, and workspace preferences."
      />

      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 w-fit flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          {activeTab === 'Business Profile' && (
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Business Profile</h3>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Company Name *</Label>
                  <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
                </div>
                <div>
                  <Label>Company Email</Label>
                  <Input type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input value={form.companyWebsite || ''} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                </div>
                <div>
                  <Label>Company Size</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.companySize || ''}
                    onChange={(e) => setForm({ ...form, companySize: e.target.value })}
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="500+">500+ employees</option>
                  </select>
                </div>
                <div>
                  <Label>Default Tax Rate %</Label>
                  <Input type="number" min="0" max="100" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value || 0) })} />
                </div>
                <div>
                  <Label>Fiscal Year Start</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.fiscalYearStart || '01'}
                    onChange={(e) => setForm({ ...form, fiscalYearStart: e.target.value })}
                  >
                    {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, index) => (
                      <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label>Address</Label>
                <Textarea rows={3} value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-card-foreground">Tax and Registration</h4>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label>GST Number</Label>
                    <Input value={form.gstNumber || ''} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label>VAT Number</Label>
                    <Input value={form.vatNumber || ''} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label>PAN / Tax ID</Label>
                    <Input value={form.panNumber || ''} onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label>Registration Number</Label>
                    <Input value={form.registrationNumber || ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Account Name</Label>
                    <Input value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Account Number</Label>
                    <Input value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label>IFSC / Routing Code</Label>
                    <Input value={form.bankIfsc || ''} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} />
                  </div>
                  <div>
                    <Label>SWIFT Code</Label>
                    <Input value={form.bankSwift || ''} onChange={(e) => setForm({ ...form, bankSwift: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4">
                  <Label>Invoice Footer Note</Label>
                  <Textarea rows={3} value={form.invoiceFooterNote || ''} onChange={(e) => setForm({ ...form, invoiceFooterNote: e.target.value })} placeholder="Payment terms, thank-you note, legal text, or remittance instructions" />
                </div>
              </div>

              <div>
                <Label>Logo</Label>
                <label className="mt-2 flex items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.logoDataUrl ? <img src={form.logoDataUrl} alt="Company logo" className="w-full h-full object-cover" /> : <img src="/riskflow-logo.png" alt="RiskFlow CRM" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = '/riskflow-logo.svg'; }} />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-card-foreground">Upload company logo</p>
                    <p className="text-xs text-muted-foreground">Used in the sidebar, setup flow, and generated PDFs</p>
                  </div>
                  {form.logoDataUrl && (
                    <button type="button" className="text-xs text-destructive hover:underline" onClick={(e) => { e.preventDefault(); setForm((current) => ({ ...current, logoDataUrl: '' })); }}>
                      Remove
                    </button>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
                </label>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <LockKeyhole className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-card-foreground">Admin and Security</h4>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Admin Login Email</Label>
                    <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                  </div>
                  <div>
                    <Label>Admin Name</Label>
                    <Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
                  </div>
                  <div>
                    <Label>Admin Password</Label>
                    <Input type="password" value={form.adminPassword || ''} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder="Leave as-is to keep current password" />
                  </div>
                  <div>
                    <Label>Workspace Lock Password</Label>
                    <Input type="password" value={form.appPassword} onChange={(e) => setForm({ ...form, appPassword: e.target.value })} placeholder="Leave blank to disable lock screen" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={isSaving}>
                  <Save className="w-4 h-4 mr-2" />{isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setForm(profile)}>Reset Changes</Button>
                <Button type="button" variant="ghost" onClick={() => { clearPassword(); setForm((current) => ({ ...current, appPassword: '' })); }}>
                  Remove Lock Password
                </Button>
                {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
              </div>
            </form>
          )}

          {activeTab === 'Currency' && (
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center gap-2 mb-5">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Currency Settings</h3>
              </div>
              <CurrencySelector />
              <div className="mt-5 p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Currency is display-only. Changing currency updates displayed money values across the app immediately.</span>
                </p>
                <p>Rate source: <span className={cn('font-medium', ratesSource === 'live' ? 'text-emerald-600' : ratesSource === 'cache' ? 'text-blue-600' : 'text-amber-600')}>{ratesSource === 'live' ? 'Live' : ratesSource === 'cache' ? 'Cached' : 'Offline fallback'}</span></p>
                <p>Selected: <span className="font-medium text-foreground">{currencyInfo.name} ({currencyInfo.code}) - {currencyInfo.symbol}</span></p>
              </div>
            </div>
          )}

          {activeTab === 'Numbering' && (
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Document Numbering</h3>
              </div>
              <p className="text-sm text-muted-foreground">Prefixes applied to auto-generated document numbers.</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Quote Prefix', key: 'quotePrefix', placeholder: 'QT' },
                  { label: 'Order Prefix', key: 'orderPrefix', placeholder: 'SO' },
                  { label: 'Invoice Prefix', key: 'invoicePrefix', placeholder: 'INV' },
                  { label: 'Payment Prefix', key: 'paymentPrefix', placeholder: 'PAY' },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })} placeholder={placeholder} maxLength={6} />
                  </div>
                ))}
              </div>
              <div className="bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Preview</p>
                <p>{form.quotePrefix || 'QT'}-0001 | {form.orderPrefix || 'SO'}-0001 | {form.invoicePrefix || 'INV'}-0001 | {form.paymentPrefix || 'PAY'}-0001</p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit"><Save className="w-4 h-4 mr-2" />Save</Button>
                {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
              </div>
            </form>
          )}

          {activeTab === 'Approvals' && (
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Approval Thresholds</h3>
              </div>
              <p className="text-sm text-muted-foreground">Any quote, purchase order, or expense above these amounts will be queued for approval. Set to 0 to require approval for all.</p>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: 'Quote Threshold', key: 'quoteApprovalThreshold' },
                  { label: 'Purchase Threshold', key: 'purchaseApprovalThreshold' },
                  { label: 'Expense Threshold', key: 'expenseApprovalThreshold' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <Label>{label}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currencyInfo.symbol}</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="pl-10"
                        value={Number(convertAmount(form[key] || 0)).toFixed(currencyInfo.decimals ?? 2)}
                        onChange={(e) => setForm({ ...form, [key]: Number(toBaseAmount(e.target.value || 0)) })}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">Stored in USD, displayed in {currencyInfo.code}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit"><Save className="w-4 h-4 mr-2" />Save</Button>
                {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
              </div>
            </form>
          )}

          {activeTab === 'Notifications' && (
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Notification Preferences</h3>
              </div>
              {[
                { label: 'Approval requests', key: 'notifyApprovals', desc: 'Alert admin when new approval requests are created' },
                { label: 'Quote converted to order', key: 'notifyConversions', desc: 'Alert when a quote is accepted and converted' },
                { label: 'Low stock alerts', key: 'notifyLowStock', desc: 'Alert when a product falls below reorder level' },
                { label: 'New team members', key: 'notifyNewUsers', desc: 'Alert admin when new users are added' },
                { label: 'Risk status changes', key: 'notifyRiskChanges', desc: 'Alert when a risk changes to high or critical' },
              ].map(({ label, key, desc }) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form[key] !== false} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button type="submit"><Save className="w-4 h-4 mr-2" />Save Preferences</Button>
                {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
              </div>
            </form>
          )}

          {activeTab === 'AI Assistant' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">AI Provider & Access</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add your own provider keys to unlock in-app AI chat. Keys stay in this browser profile and are not synced anywhere else.
                </p>

                <div className="grid gap-4 xl:grid-cols-3">
                  {[
                    {
                      provider: 'openai',
                      title: 'OpenAI',
                      keyField: 'openaiApiKey',
                      placeholder: 'gpt-4.1-mini',
                      accent: 'border-emerald-200 bg-emerald-50/60',
                    },
                    {
                      provider: 'anthropic',
                      title: 'Anthropic',
                      keyField: 'anthropicApiKey',
                      placeholder: 'claude-3-5-sonnet-latest',
                      accent: 'border-orange-200 bg-orange-50/60',
                    },
                    {
                      provider: 'gemini',
                      title: 'Google Gemini',
                      keyField: 'geminiApiKey',
                      placeholder: 'gemini-2.0-flash',
                      accent: 'border-blue-200 bg-blue-50/60',
                    },
                  ].map((item) => {
                    const selected = form.aiProvider === item.provider;
                    return (
                      <button
                        key={item.provider}
                        type="button"
                        onClick={() => setForm({ ...form, aiProvider: item.provider })}
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-all',
                          selected ? item.accent : 'border-border bg-background hover:border-primary/30'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-card-foreground">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {form[item.keyField] ? 'API key configured' : 'API key not added'}
                            </p>
                          </div>
                          {selected && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">Active</span>}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div>
                            <Label>{item.title} API Key</Label>
                            <Input
                              type="password"
                              value={form[item.keyField] || ''}
                              onChange={(e) => setForm({ ...form, [item.keyField]: e.target.value })}
                              placeholder="Paste API key"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div>
                            <Label>Model</Label>
                            <Input
                              value={`Auto chosen by provider (${item.placeholder})`}
                              readOnly
                              disabled
                              onClick={(e) => e.stopPropagation()}
                              className="bg-muted/60 text-muted-foreground"
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">Chat Behavior & Security</h3>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">Default to Focus Mode</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Focus Mode limits the assistant to RiskFlow workspace data and app context only.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={form.aiFocusModeDefault !== false}
                          onChange={(e) => setForm({ ...form, aiFocusModeDefault: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-sm font-semibold text-card-foreground">Allow AI for non-admin users</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          When disabled, only admins can use the AI drawer.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={form.aiUsageForUsers !== false}
                          onChange={(e) => setForm({ ...form, aiUsageForUsers: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                    <Label>General Chat Password</Label>
                    <Input
                      type="password"
                      value={form.aiGeneralPassword || ''}
                      onChange={(e) => setForm({ ...form, aiGeneralPassword: e.target.value })}
                      placeholder="Optional password required before broad chat"
                      className="mt-2"
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Leave blank to allow general chat without an extra password. Focus Mode does not require this password.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
                  <p className="flex items-start gap-2">
                    <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Provider keys are stored only in this browser session storage profile. This local-first setup is convenient, but not suitable for shared enterprise secret management.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>The in-app AI drawer will automatically use the active provider: <span className="font-medium text-foreground">{activeAiProvider.label}</span>.</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">AES local record encryption</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Encrypt local record storage using the current workspace secret material. Changing admin or app passwords will rewrap local data.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={form.enableLocalEncryption !== false}
                        onChange={(e) => setForm({ ...form, enableLocalEncryption: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit"><Save className="w-4 h-4 mr-2" />Save AI Settings</Button>
                  {saved && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
                </div>
              </div>
            </form>
          )}

          {activeTab === 'Data' && (
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">Export Backup</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Download all workspace data as a single JSON file.</p>
                <div className="flex items-center gap-3">
                  <Button onClick={handleExport}><Download className="w-4 h-4 mr-2" />Download Backup</Button>
                  {exportMsg && <span className="text-sm text-emerald-600">{exportMsg}</span>}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Upload className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-card-foreground">Import Backup</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Restore a previously exported backup file. This will overwrite current records.</p>
                <label className="inline-flex cursor-pointer">
                  <input type="file" accept="application/json" className="hidden" onChange={handleImport} />
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors">
                    <Upload className="w-4 h-4" />Choose Backup File
                  </span>
                </label>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Trash2 className="w-4 h-4 text-destructive" />
                  <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Clear all workspace records while preserving the business profile and settings.</p>
                <Button variant="destructive" onClick={handleClearData}>
                  <Trash2 className="w-4 h-4 mr-2" />Clear All Data
                </Button>
                <div className="mt-5 rounded-xl border border-destructive/20 bg-white/60 p-4">
                  <p className="text-sm font-semibold text-card-foreground">Secure Erase</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Overwrite local storage with phantom data for multiple passes, then permanently erase all app data and settings.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <select
                      className="flex h-10 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={secureErasePasses}
                      onChange={(e) => setSecureErasePasses(e.target.value)}
                    >
                      {['2', '3', '5', '10'].map((count) => (
                        <option key={count} value={count}>{count} passes</option>
                      ))}
                    </select>
                    <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/5" onClick={handleSecureErase}>
                      Secure Erase
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Business Preview</h3>
            <div className="rounded-2xl border border-border bg-muted/20 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.logoDataUrl ? <img src={form.logoDataUrl} alt={form.companyName || 'Company logo'} className="w-full h-full object-cover" /> : <img src="/riskflow-logo.png" alt="RiskFlow CRM" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.src = '/riskflow-logo.svg'; }} />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-card-foreground truncate">{form.companyName || 'Your Company'}</p>
                  <p className="text-xs text-muted-foreground truncate">{form.companyEmail || 'company@example.com'}</p>
                </div>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                {form.industry && <p>{form.industry}{form.companySize ? ` | ${form.companySize}` : ''}</p>}
                {form.companyPhone && <p>{form.companyPhone}</p>}
                {form.companyWebsite && <p>{form.companyWebsite}</p>}
                {form.companyAddress && <p className="whitespace-pre-line">{form.companyAddress}</p>}
                {(form.gstNumber || form.vatNumber || form.registrationNumber) && (
                  <p>GST: {form.gstNumber || '-'} | VAT: {form.vatNumber || '-'} | Reg: {form.registrationNumber || '-'}</p>
                )}
                <p className="flex items-center gap-1 pt-1">
                  <LockKeyhole className="w-3 h-3 text-primary" />
                  {form.appPassword ? 'Lock screen enabled' : 'Lock screen disabled'}
                </p>
                <p className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-primary" />
                  {currencyInfo.name} ({currencyInfo.code}) - {currencyInfo.symbol}
                </p>
                <p className="pt-1">Tax: {form.taxRate || 0}% | FY starts: {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(form.fiscalYearStart || 1) - 1]}</p>
                <p>Prefixes: {form.quotePrefix}/{form.orderPrefix}/{form.invoicePrefix}/{form.paymentPrefix}</p>
                <p>Approvals: Q {formatMoney(form.quoteApprovalThreshold)} | P {formatMoney(form.purchaseApprovalThreshold)} | E {formatMoney(form.expenseApprovalThreshold)}</p>
                <p>AI: {activeAiProvider.label} {activeAiProvider.apiKey ? 'configured' : 'not configured'} | Default mode: {form.aiFocusModeDefault !== false ? 'Focus' : 'General'} | User access: {form.aiUsageForUsers !== false ? 'Enabled' : 'Admins only'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
