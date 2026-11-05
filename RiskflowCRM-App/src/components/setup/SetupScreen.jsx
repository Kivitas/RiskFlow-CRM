import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBusiness } from '@/lib/BusinessContext';
import { useAuth } from '@/lib/AuthContext';
import AppLogo from '@/components/shared/AppLogo';

const MIN_ADMIN_PASSWORD_LENGTH = 8;
const MAX_LOGO_BYTES = 1024 * 1024;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the logo file. Try a different image.'));
    reader.readAsDataURL(file);
  });

const PasswordToggle = ({ shown, onToggle, label }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={shown ? `Hide ${label}` : `Show ${label}`}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
  >
    {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
  </button>
);

export default function SetupScreen() {
  const { saveProfile } = useBusiness();
  const { checkAppState } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    companyEmail: '',
    companyPhone: '',
    companyAddress: '',
    appPassword: '',
    adminName: 'Admin',
    adminEmail: '',
    adminPassword: '',
    confirmAdminPassword: '',
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [logoError, setLogoError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setFormError('');
  };

  const handleLogoChange = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    setLogoError('');
    if (!file) {
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setLogoError('Logo must be 1 MB or smaller. Choose a smaller image.');
      input.value = '';
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setLogoPreview(dataUrl);
    } catch (error) {
      setLogoError(error.message || 'Could not read the logo file.');
      input.value = '';
    }
  };

  const validate = () => {
    const companyEmail = form.companyEmail.trim();
    if (companyEmail && !EMAIL_PATTERN.test(companyEmail)) {
      return 'Enter a valid company email address, or leave it blank.';
    }
    if (!EMAIL_PATTERN.test(form.adminEmail.trim())) {
      return 'Enter a valid admin login email address.';
    }
    if (form.adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
      return `Admin login password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`;
    }
    if (form.adminPassword !== form.confirmAdminPassword) {
      return 'Admin login passwords do not match.';
    }
    if (logoError) {
      return logoError;
    }
    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }

    setIsSaving(true);
    setFormError('');
    try {
      // saveProfile hashes the lock password and writes the profile before resolving,
      // so checkAppState sees the new profile in storage.
      await saveProfile({
        companyName: form.companyName.trim(),
        companyEmail: form.companyEmail.trim(),
        companyPhone: form.companyPhone,
        companyAddress: form.companyAddress,
        appPassword: form.appPassword,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim().toLowerCase(),
        adminPassword: form.adminPassword,
        logoDataUrl: logoPreview,
      });
      await checkAppState();
    } catch (error) {
      setFormError(error.message || 'Could not save the workspace. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid lg:grid-cols-[0.92fr_1.08fr] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]">
        <div className="relative overflow-hidden p-8 lg:p-10 bg-[linear-gradient(180deg,#050824_0%,#0b1d42_56%,#11164c_100%)] text-white">
          <AppLogo className="mb-7 h-20 w-20 rounded-lg" />
          <h1 className="text-3xl font-bold tracking-tight mb-3">Sign up your workspace</h1>
          <p className="text-sm text-white/75 max-w-md">
            Create the first admin account and business profile. The app will keep this data locally on this browser origin.
          </p>
          <div className="mt-8 space-y-3 text-sm text-white/82">
            {['Company branding on invoices and exports', 'Local admin login and optional app lock', 'Data stays on this browser unless exported'].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-blue-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-7 lg:p-9 space-y-5">
          <div>
            <Label htmlFor="setup-company-name">Company Name *</Label>
            <Input id="setup-company-name" className="mt-2" autoComplete="organization" value={form.companyName} onChange={updateField('companyName')} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="setup-company-email">Company Email</Label>
              <div className="relative mt-2">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="setup-company-email" type="email" className="pl-9" autoComplete="email" value={form.companyEmail} onChange={updateField('companyEmail')} />
              </div>
            </div>
            <div>
              <Label htmlFor="setup-company-phone">Phone</Label>
              <div className="relative mt-2">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input id="setup-company-phone" type="tel" className="pl-9" autoComplete="tel" value={form.companyPhone} onChange={updateField('companyPhone')} />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="setup-admin-name">Admin Name *</Label>
              <Input id="setup-admin-name" className="mt-2" autoComplete="name" value={form.adminName} onChange={updateField('adminName')} required />
            </div>
            <div>
              <Label htmlFor="setup-admin-email">Admin Login Email *</Label>
              <Input id="setup-admin-email" type="email" className="mt-2" autoComplete="username" value={form.adminEmail} onChange={updateField('adminEmail')} required />
            </div>
          </div>
          <div>
            <Label htmlFor="setup-address">Address</Label>
            <div className="relative mt-2">
              <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Textarea id="setup-address" className="pl-9 min-h-[84px]" autoComplete="street-address" value={form.companyAddress} onChange={updateField('companyAddress')} />
            </div>
          </div>
          <div>
            <span className="text-sm font-medium leading-none">Logo</span>
            <label htmlFor="setup-logo" className="mt-2 flex items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden">
                {logoPreview ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" /> : <img src="/riskflow-logo.png" alt="RiskFlow CRM" className="w-full h-full object-cover" onError={(event) => { event.currentTarget.src = '/riskflow-logo.svg'; }} />}
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Upload logo</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or SVG, up to 1 MB</p>
              </div>
              <input id="setup-logo" type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
            </label>
            {logoError && <p role="alert" className="mt-2 text-xs text-red-700">{logoError}</p>}
          </div>
          <div>
            <Label htmlFor="setup-app-password">Workspace Lock Password (optional, locks the screen)</Label>
            <div className="relative mt-2">
              <LockKeyhole className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="setup-app-password"
                type={showAppPassword ? 'text' : 'password'}
                className="pl-9 pr-10"
                autoComplete="new-password"
                value={form.appPassword}
                onChange={updateField('appPassword')}
                placeholder="Leave blank to skip"
              />
              <PasswordToggle shown={showAppPassword} onToggle={() => setShowAppPassword((shown) => !shown)} label="lock password" />
            </div>
          </div>
          <div>
            <Label htmlFor="setup-admin-password">Admin Login Password *</Label>
            <div className="relative mt-2">
              <Input
                id="setup-admin-password"
                type={showAdminPassword ? 'text' : 'password'}
                className="pr-10"
                autoComplete="new-password"
                minLength={MIN_ADMIN_PASSWORD_LENGTH}
                value={form.adminPassword}
                onChange={updateField('adminPassword')}
                placeholder={`At least ${MIN_ADMIN_PASSWORD_LENGTH} characters`}
                required
              />
              <PasswordToggle shown={showAdminPassword} onToggle={() => setShowAdminPassword((shown) => !shown)} label="admin password" />
            </div>
          </div>
          <div>
            <Label htmlFor="setup-confirm-admin-password">Confirm Admin Login Password *</Label>
            <Input
              id="setup-confirm-admin-password"
              type={showAdminPassword ? 'text' : 'password'}
              className="mt-2"
              autoComplete="new-password"
              value={form.confirmAdminPassword}
              onChange={updateField('confirmAdminPassword')}
              required
            />
          </div>
          {formError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save and Open Workspace'}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            After sign-up, reopen the app at the same URL (http://127.0.0.1:5173) so the browser uses the same local storage origin.
          </p>
        </form>
      </div>
    </div>
  );
}
