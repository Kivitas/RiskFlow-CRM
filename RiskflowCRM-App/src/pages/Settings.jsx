import React, { useEffect, useMemo, useState } from 'react';
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
import { SECRET_PLACEHOLDER, useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import { getAiProviderConfig } from '@/lib/aiClient';
import PageHeader from '@/components/shared/PageHeader';
import CurrencySelector from '@/components/shared/CurrencySelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';

const TABS = ['Business Profile', 'Currency', 'Numbering', 'Approvals', 'Notifications', 'AI Assistant', 'Data'];

const PASSWORD_NOT_ALLOWED_MESSAGE = 'That password is not allowed';

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

// True when the form differs from the saved profile. The admin password is never stored in
// the profile, so any typed value counts as a change.
const isFormDirty = (form, profile) => {
  if (form.adminPassword) {
    return true;
  }
  const keys = new Set([...Object.keys(profile), ...Object.keys(form)]);
  keys.delete('adminPassword');
  return [...keys].some((key) => form[key] !== profile[key]);
};

function SaveStatus({ saved, dirty }) {
  if (saved) {
    return <span role="status" className="text-sm text-emerald-600 font-medium">Saved</span>;
  }
  if (dirty) {
    return <span role="status" className="text-sm text-amber-600 font-medium">Unsaved changes</span>;
  }
  return null;
}

// A lock password input. The stored secret arrives as SECRET_PLACEHOLDER and is never shown.
// Empty input with a lock set means "keep". "Remove password" sets the value to '' explicitly.
function LockPasswordField({
  id,
  label,
  value,
  lockSet,
  error,
  onChange,
  onRemove,
  onKeep,
  emptyPlaceholder,
  helpText,
  className = '',
}) {
  const isRemoving = lockSet && value === '';
  const displayValue = value === SECRET_PLACEHOLDER || !value ? '' : value;
  const hintId = `${id}-hint`;

  let hint = helpText;
  if (lockSet) {
    if (isRemoving) {
      hint = 'The password will be removed when you save.';
    } else if (value === SECRET_PLACEHOLDER) {
      hint = 'A password is set. Leave blank to keep it.';
    } else {
      hint = 'The new password replaces the current one when you save.';
    }
  }

  let inputPlaceholder = emptyPlaceholder;
  if (lockSet) {
    inputPlaceholder = isRemoving ? 'Will be removed on save' : 'Password set — type to change';
  }

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        value={displayValue}
        onChange={onChange}
        placeholder={inputPlaceholder}
        aria-invalid={Boolean(error)}
        aria-describedby={hintId}
        className="mt-2"
      />
      <div className="mt-1 flex items-start justify-between gap-3">
        {error ? (
          <p id={hintId} role="alert" className="text-xs text-destructive">{error}</p>
        ) : (
          <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
        )}
        {lockSet && (isRemoving ? (
          <button type="button" className="flex-shrink-0 text-xs text-primary hover:underline" onClick={onKeep}>
            Keep current password
          </button>
        ) : (
          <button type="button" className="flex-shrink-0 text-xs text-destructive hover:underline" onClick={onRemove}>
            Remove password
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const { profile, saveProfile, clearPassword } = useBusiness();
  const { user, checkUserAuth } = useAuth();
  const confirm = useConfirm();
  const { currencyInfo, ratesSource, convertAmount, toBaseAmount, formatMoney } = useCurrency();
  // The admin password is never kept in the form or the profile (a legacy profile may still carry a
  // plaintext copy), so the form always starts with it blank.
  const [form, setForm] = useState(() => ({ ...profile, adminPassword: '' }));
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('Business Profile');
  const [exportMsg, setExportMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [secureErasePasses, setSecureErasePasses] = useState('3');
  const activeAiProvider = getAiProviderConfig(form);
  const isDirty = useMemo(() => isFormDirty(form, profile), [form, profile]);
  const appLockSet = profile.appPassword === SECRET_PLACEHOLDER;
  const aiLockSet = profile.aiGeneralPassword === SECRET_PLACEHOLDER;

  useEffect(() => {
    setForm({
      ...profile,
      adminPassword: '',
    });
    setPasswordErrors({});
  }, [profile]);

  const handleLogoChange = async (event) => {
    const dataUrl = await readFileAsDataUrl(event.target.files?.[0]);
    setForm((current) => ({ ...current, logoDataUrl: dataUrl }));
  };

  const showSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  // Typing replaces the value. Clearing a field that has a stored lock goes back to "keep".
  // Removing a lock is explicit, through the Remove password button.
  const handlePasswordInput = (field, lockSet = false) => (event) => {
    const next = event.target.value;
    if (next === SECRET_PLACEHOLDER) {
      setPasswordErrors((current) => ({ ...current, [field]: PASSWORD_NOT_ALLOWED_MESSAGE }));
      return;
    }
    setPasswordErrors((current) => ({ ...current, [field]: '' }));
    setForm((current) => ({ ...current, [field]: next === '' && lockSet ? SECRET_PLACEHOLDER : next }));
  };

  const handleRemovePassword = (field) => {
    setPasswordErrors((current) => ({ ...current, [field]: '' }));
    setForm((current) => ({ ...current, [field]: '' }));
  };

  const handleKeepPassword = (field) => {
    setPasswordErrors((current) => ({ ...current, [field]: '' }));
    setForm((current) => ({ ...current, [field]: SECRET_PLACEHOLDER }));
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
      const payload = {
        ...form,
        adminName: String(form.adminName || '').trim(),
        adminEmail: String(form.adminEmail || '').trim().toLowerCase(),
      };
      // Admin passwords go through crmClient.users.update only. Never store them in the profile.
      delete payload.adminPassword;
      await saveProfile(payload);
      setForm((current) => ({ ...current, adminPassword: '' }));
      showSaved();
    } catch (error) {
      toast({ title: 'Save failed', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const snapshot = await crmClient.backups.exportAll();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${profile.companyName || 'riskflow'}-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportMsg('Backup downloaded');
      toast({ title: 'Backup downloaded', description: 'A fresh workspace backup was exported. It contains AI API keys, so store it securely.' });
      window.setTimeout(() => setExportMsg(''), 2000);
    } catch (error) {
      toast({ title: 'Export failed', description: error.message || 'Failed to export backup', variant: 'destructive' });
    }
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
    try {
      await crmClient.backups.secureErase({ passes: Number(secureErasePasses) });
      window.location.reload();
    } catch (error) {
      toast({ title: 'Erase failed', description: error.message || 'Failed to erase workspace', variant: 'destructive' });
    }
  };

  const saveDisabled = isSaving || !isDirty;

  return (
    <div>
      <PageHeader
        title="Business Settings"
        subtitle="Branding, numbering, approval thresholds, currency, and workspace preferences."
      />

      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-6 w-fit flex-wrap" role="tablist" aria-label="Settings sections">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
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
                  <Label htmlFor="settings-companyName">Company Name *</Label>
                  <Input id="settings-companyName" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="settings-companyEmail">Company Email</Label>
                  <Input id="settings-companyEmail" type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="settings-companyPhone">Phone</Label>
                  <Input id="settings-companyPhone" value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="settings-companyWebsite">Website</Label>
                  <Input id="settings-companyWebsite" value={form.companyWebsite || ''} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="settings-industry">Industry</Label>
                  <Input id="settings-industry" value={form.industry || ''} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="settings-companySize">Company Size</Label>
                  <select
                    id="settings-companySize"
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
                  <Label htmlFor="settings-taxRate">Default Tax Rate %</Label>
                  <Input id="settings-taxRate" type="number" min="0" max="100" step="0.1" value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value || 0) })} />
                </div>
                <div>
                  <Label htmlFor="settings-fiscalYearStart">Fiscal Year Start</Label>
                  <select
                    id="settings-fiscalYearStart"
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
                <Label htmlFor="settings-companyAddress">Address</Label>
                <Textarea id="settings-companyAddress" rows={3} value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} />
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-card-foreground">Tax and Registration</h4>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="settings-gstNumber">GST Number</Label>
                    <Input id="settings-gstNumber" value={form.gstNumber || ''} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-vatNumber">VAT Number</Label>
                    <Input id="settings-vatNumber" value={form.vatNumber || ''} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-panNumber">PAN / Tax ID</Label>
                    <Input id="settings-panNumber" value={form.panNumber || ''} onChange={(e) => setForm({ ...form, panNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-registrationNumber">Registration Number</Label>
                    <Input id="settings-registrationNumber" value={form.registrationNumber || ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-bankName">Bank Name</Label>
                    <Input id="settings-bankName" value={form.bankName || ''} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-bankAccountName">Account Name</Label>
                    <Input id="settings-bankAccountName" value={form.bankAccountName || ''} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-bankAccountNumber">Account Number</Label>
                    <Input id="settings-bankAccountNumber" value={form.bankAccountNumber || ''} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-bankIfsc">IFSC / Routing Code</Label>
                    <Input id="settings-bankIfsc" value={form.bankIfsc || ''} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-bankSwift">SWIFT Code</Label>
                    <Input id="settings-bankSwift" value={form.bankSwift || ''} onChange={(e) => setForm({ ...form, bankSwift: e.target.value })} />
                  </div>
                </div>
                <div className="mt-4">
                  <Label htmlFor="settings-invoiceFooterNote">Invoice Footer Note</Label>
                  <Textarea id="settings-invoiceFooterNote" rows={3} value={form.invoiceFooterNote || ''} onChange={(e) => setForm({ ...form, invoiceFooterNote: e.target.value })} placeholder="Payment terms, thank-you note, legal text, or remittance instructions" />
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
                  <input type="file" className="hidden" accept="image/*" aria-label="Upload company logo" onChange={handleLogoChange} />
                </label>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                  <LockKeyhole className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-card-foreground">Admin and Security</h4>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="settings-adminEmail">Admin Login Email</Label>
                    <Input id="settings-adminEmail" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-adminName">Admin Name</Label>
                    <Input id="settings-adminName" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="settings-adminPassword">Admin Password</Label>
                    <Input
                      id="settings-adminPassword"
                      type="password"
                      autoComplete="new-password"
                      className="mt-2"
                      value={form.adminPassword || ''}
                      onChange={handlePasswordInput('adminPassword')}
                      placeholder="Leave as-is to keep current password"
                      aria-invalid={Boolean(passwordErrors.adminPassword)}
                      aria-describedby="settings-adminPassword-hint"
                    />
                    <p id="settings-adminPassword-hint" role={passwordErrors.adminPassword ? 'alert' : undefined} className={cn('mt-1 text-xs', passwordErrors.adminPassword ? 'text-destructive' : 'text-muted-foreground')}>
                      {passwordErrors.adminPassword || 'Changing this updates your login password on save.'}
                    </p>
                  </div>
                  <LockPasswordField
                    id="settings-appPassword"
                    label="Workspace Lock Password"
                    value={form.appPassword}
                    lockSet={appLockSet}
                    error={passwordErrors.appPassword}
                    onChange={handlePasswordInput('appPassword', appLockSet)}
                    onRemove={() => handleRemovePassword('appPassword')}
                    onKeep={() => handleKeepPassword('appPassword')}
                    emptyPlaceholder="Leave blank to disable lock screen"
                    helpText="Leave blank to disable lock screen."
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saveDisabled}>
                  <Save className="w-4 h-4 mr-2" />{isSaving ? 'Saving...' : 'Save Settings'}
                </Button>
                <Button type="button" variant="outline" disabled={isSaving || !isDirty} onClick={() => { setForm({ ...profile, adminPassword: '' }); setPasswordErrors({}); }}>Reset Changes</Button>
                <Button type="button" variant="ghost" onClick={() => { clearPassword(); setForm((current) => ({ ...current, appPassword: '' })); }}>
                  Remove Lock Password
                </Button>
                <SaveStatus saved={saved} dirty={isDirty} />
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
                    <Label htmlFor={`settings-${key}`}>{label}</Label>
                    <Input id={`settings-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value.toUpperCase() })} placeholder={placeholder} maxLength={6} />
                  </div>
                ))}
              </div>
              <div className="bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Preview</p>
                <p>{form.quotePrefix || 'QT'}-0001 | {form.orderPrefix || 'SO'}-0001 | {form.invoicePrefix || 'INV'}-0001 | {form.paymentPrefix || 'PAY'}-0001</p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saveDisabled}><Save className="w-4 h-4 mr-2" />Save</Button>
                <SaveStatus saved={saved} dirty={isDirty} />
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
                    <Label htmlFor={`settings-${key}`}>{label}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">{currencyInfo.symbol}</span>
                      <Input
                        id={`settings-${key}`}
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
                <Button type="submit" disabled={saveDisabled}><Save className="w-4 h-4 mr-2" />Save</Button>
                <SaveStatus saved={saved} dirty={isDirty} />
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
                    <input type="checkbox" className="sr-only peer" aria-label={label} checked={form[key] !== false} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saveDisabled}><Save className="w-4 h-4 mr-2" />Save Preferences</Button>
                <SaveStatus saved={saved} dirty={isDirty} />
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
                    const keyId = `settings-${item.keyField}`;
                    return (
                      <button
                        key={item.provider}
                        type="button"
                        onClick={() => setForm({ ...form, aiProvider: item.provider })}
                        aria-pressed={selected}
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
                            <Label htmlFor={keyId}>{item.title} API Key</Label>
                            <Input
                              id={keyId}
                              type="password"
                              autoComplete="off"
                              value={form[item.keyField] || ''}
                              onChange={(e) => setForm({ ...form, [item.keyField]: e.target.value })}
                              placeholder="Paste API key"
                              onClick={(e) => e.stopPropagation()}
                              aria-describedby={`${keyId}-warning`}
                            />
                            <p id={`${keyId}-warning`} className="mt-1 text-[11px] text-amber-700">
                              Stored in this browser only. Anyone using this browser profile can read it.
                            </p>
                          </div>
                          <div>
                            <Label htmlFor={`${keyId}-model`}>Model</Label>
                            <Input
                              id={`${keyId}-model`}
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
                        <p id="settings-focusMode-label" className="text-sm font-semibold text-card-foreground">Default to Focus Mode</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Focus Mode limits the assistant to RiskFlow workspace data and app context only.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          aria-labelledby="settings-focusMode-label"
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
                        <p id="settings-aiUsage-label" className="text-sm font-semibold text-card-foreground">Allow AI for non-admin users</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          When disabled, only admins can use the AI drawer.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          aria-labelledby="settings-aiUsage-label"
                          checked={form.aiUsageForUsers !== false}
                          onChange={(e) => setForm({ ...form, aiUsageForUsers: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                    </div>
                    <LockPasswordField
                      id="settings-aiGeneralPassword"
                      label="General Chat Password"
                      value={form.aiGeneralPassword}
                      lockSet={aiLockSet}
                      error={passwordErrors.aiGeneralPassword}
                      onChange={handlePasswordInput('aiGeneralPassword', aiLockSet)}
                      onRemove={() => handleRemovePassword('aiGeneralPassword')}
                      onKeep={() => handleKeepPassword('aiGeneralPassword')}
                      emptyPlaceholder="Optional password required before broad chat"
                      helpText="Leave blank to allow general chat without an extra password. Focus Mode does not require this password."
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
                  <p className="flex items-start gap-2">
                    <KeyRound className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>Provider keys are stored only in this browser session storage profile. This local-first setup is convenient, but not suitable for shared enterprise secret management.</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>The in-app AI drawer will automatically use the active provider: <span className="font-medium text-foreground">{activeAiProvider.label}</span>.</span>
                  </p>
                </div>

                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p id="settings-encryption-label" className="text-sm font-semibold text-card-foreground">AES local record encryption</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Encrypt local record storage using the current workspace secret material. Changing admin or app passwords will rewrap local data.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        aria-labelledby="settings-encryption-label"
                        checked={form.enableLocalEncryption !== false}
                        onChange={(e) => setForm({ ...form, enableLocalEncryption: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saveDisabled}><Save className="w-4 h-4 mr-2" />Save AI Settings</Button>
                  <SaveStatus saved={saved} dirty={isDirty} />
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
                  <input type="file" accept="application/json" className="hidden" aria-label="Choose backup file to import" onChange={handleImport} />
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
                      id="settings-secureErasePasses"
                      aria-label="Number of overwrite passes"
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
                  <LockKeyhole className="w-3 h-3 text-primary" aria-hidden="true" />
                  {form.appPassword ? 'Lock screen enabled' : 'Lock screen disabled'}
                </p>
                <p className="flex items-center gap-1">
                  <Globe className="w-3 h-3 text-primary" aria-hidden="true" />
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
