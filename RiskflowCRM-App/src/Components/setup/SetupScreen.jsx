import React, { useState } from 'react';
import { CheckCircle2, LockKeyhole, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useBusiness } from '@/lib/BusinessContext';
import { useAuth } from '@/lib/AuthContext';
import AppLogo from '@/components/shared/AppLogo';

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
  });
  const [logoPreview, setLogoPreview] = useState('');

  const handleLogoChange = async (event) => {
    const file = event.target.files?.[0];
    const dataUrl = await readFileAsDataUrl(file);
    setLogoPreview(dataUrl);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    saveProfile({
      ...form,
      logoDataUrl: logoPreview,
    });
    await checkAppState();
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
            <Label>Company Name *</Label>
            <Input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} required />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Company Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={form.companyEmail} onChange={(event) => setForm({ ...form, companyEmail: event.target.value })} />
              </div>
            </div>
            <div>
              <Label>Phone</Label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" value={form.companyPhone} onChange={(event) => setForm({ ...form, companyPhone: event.target.value })} />
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Admin Name *</Label>
              <Input value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} required />
            </div>
            <div>
              <Label>Admin Login Email *</Label>
              <Input type="email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} required />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Textarea className="pl-9 min-h-[84px]" value={form.companyAddress} onChange={(event) => setForm({ ...form, companyAddress: event.target.value })} />
            </div>
          </div>
          <div>
            <Label>Logo</Label>
            <label className="mt-2 flex items-center gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden">
                {logoPreview ? <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" /> : <img src="/riskflow-logo.png" alt="RiskFlow CRM" className="w-full h-full object-cover" onError={(event) => { event.currentTarget.src = '/riskflow-logo.svg'; }} />}
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Upload logo</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or SVG supported</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleLogoChange} />
            </label>
          </div>
          <div>
            <Label>Workspace Lock Password</Label>
            <div className="relative">
              <LockKeyhole className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                className="pl-9"
                value={form.appPassword}
                onChange={(event) => setForm({ ...form, appPassword: event.target.value })}
                placeholder="Leave blank to skip"
              />
            </div>
          </div>
          <div>
            <Label>Admin Login Password *</Label>
            <Input
              type="password"
              value={form.adminPassword}
              onChange={(event) => setForm({ ...form, adminPassword: event.target.value })}
              placeholder="Used to sign in to the app"
              required
            />
          </div>
          <Button type="submit" className="w-full">Save and Open Workspace</Button>
          <p className="text-xs leading-5 text-muted-foreground">
            After sign-up, reopen the app from RiskflowCRM.bat so the browser uses the same local storage origin.
          </p>
        </form>
      </div>
    </div>
  );
}
