import React, { useState } from 'react';
import { LockKeyhole, Mail, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBusiness } from '@/lib/BusinessContext';
import { useAuth } from '@/lib/AuthContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { crmClient } from '@/api/crmClient';
import AppLogo from '@/components/shared/AppLogo';

export default function LoginScreen() {
  const { profile } = useBusiness();
  const { login, authError, isLoadingAuth } = useAuth();
  const confirm = useConfirm();
  const [email, setEmail] = useState(profile.adminEmail || profile.companyEmail || '');
  const [password, setPassword] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(email, password);
    setPassword('');
  };

  const handleCreateNewWorkspace = async () => {
    const confirmed = await confirm({
      title: 'Create a new workspace?',
      description: 'This clears the local workspace on this browser and opens the sign-up screen for a fresh admin account.',
      confirmLabel: 'Reset and sign up',
      destructive: true,
    });
    if (!confirmed) {
      return;
    }
    await crmClient.backups.secureErase({ passes: 1 });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid lg:grid-cols-[1.05fr_0.95fr] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)]">
        <div className="p-8 lg:p-10 bg-[linear-gradient(180deg,#050824_0%,#0b1d42_56%,#11164c_100%)] text-white">
          <AppLogo src={profile.logoDataUrl} alt={profile.companyName || 'RiskFlow CRM'} className="mb-7 h-20 w-20 rounded-lg" />
          <h1 className="text-3xl font-bold tracking-tight mb-3">{profile.companyName || 'RiskFlow CRM'}</h1>
          <p className="text-sm text-white/75 max-w-md">
            Sign in with your team account to access CRM, sales, inventory, procurement, and finance records.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 lg:p-10 space-y-5">
          <div>
            <Label>Email</Label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" className="pl-9" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <LockKeyhole className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="password" className="pl-9" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
          </div>
          {authError?.message && authError.type !== 'auth_required' && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {authError.message}
            </div>
          )}
          <Button type="submit" className="w-full" disabled={isLoadingAuth}>
            {isLoadingAuth ? 'Signing In...' : 'Sign In'}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={handleCreateNewWorkspace}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create / Sign Up New Workspace
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            Use the same URL every time. The launcher opens 127.0.0.1:5173 so local browser data stays on one origin.
          </p>
        </form>
      </div>
    </div>
  );
}
