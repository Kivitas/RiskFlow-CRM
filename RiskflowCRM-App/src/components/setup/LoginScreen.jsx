import React, { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBusiness } from '@/lib/BusinessContext';
import { useAuth } from '@/lib/AuthContext';
import { crmClient } from '@/api/crmClient';
import AppLogo from '@/components/shared/AppLogo';

const RESET_CONFIRM_WORD = 'RESET';

export default function LoginScreen() {
  const { profile, requiresPassword, verifyAppLockPassword } = useBusiness();
  const { login, authError, isLoadingAuth, clearAuthError } = useAuth();
  const [email, setEmail] = useState(profile.adminEmail || profile.companyEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(email, password);
    setPassword('');
  };

  const openResetPanel = () => {
    setIsResetOpen((open) => !open);
    setResetInput('');
    setResetError('');
  };

  // Erasing the workspace needs the typed word RESET, or the app lock password when one is set.
  // RESET is always accepted so a forgotten lock password cannot block the reset path (LockScreen
  // offers the same RESET-only reset).
  const handleResetWorkspace = async (event) => {
    event.preventDefault();
    setResetError('');

    const typedReset = resetInput.trim() === RESET_CONFIRM_WORD;
    if (!typedReset) {
      if (!requiresPassword) {
        setResetError(`Type ${RESET_CONFIRM_WORD} to confirm.`);
        return;
      }
      const allowed = await verifyAppLockPassword(resetInput);
      if (!allowed) {
        setResetError(`Incorrect app lock password. Type ${RESET_CONFIRM_WORD} to erase without it.`);
        return;
      }
    }

    setIsResetting(true);
    try {
      await crmClient.backups.secureErase({ passes: 1 });
      window.location.reload();
    } catch (error) {
      setResetError(error.message || 'Could not erase the workspace.');
      setIsResetting(false);
    }
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

        <div className="p-8 lg:p-10 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="login-email">Email</Label>
              <div className="relative mt-2">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  className="pl-9"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearAuthError();
                  }}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="login-password">Password</Label>
              <div className="relative mt-2">
                <LockKeyhole className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearAuthError();
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {authError?.message && authError.type !== 'auth_required' && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {authError.message}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoadingAuth}>
              {isLoadingAuth ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={openResetPanel}
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              aria-expanded={isResetOpen}
            >
              Create a new workspace instead
            </button>

            {isResetOpen && (
              <form onSubmit={handleResetWorkspace} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  This permanently erases all data stored in this browser, then opens the sign-up screen.
                </p>
                <Label htmlFor="reset-confirm" className="text-xs">
                  {requiresPassword
                    ? `Enter your app lock password, or type ${RESET_CONFIRM_WORD}, to continue`
                    : `Type ${RESET_CONFIRM_WORD} to continue`}
                </Label>
                <Input
                  id="reset-confirm"
                  type={requiresPassword ? 'password' : 'text'}
                  autoComplete="off"
                  value={resetInput}
                  onChange={(event) => {
                    setResetInput(event.target.value);
                    setResetError('');
                  }}
                />
                {resetError && <p role="alert" className="text-xs text-red-700">{resetError}</p>}
                <div className="flex items-center gap-3">
                  <Button type="submit" variant="destructive" size="sm" disabled={isResetting || !resetInput}>
                    {isResetting ? 'Erasing...' : 'Erase and start over'}
                  </Button>
                  <button type="button" onClick={openResetPanel} className="text-xs text-muted-foreground underline underline-offset-4">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Use the same URL every time. The launcher opens 127.0.0.1:5173 so local browser data stays on one origin.
          </p>
        </div>
      </div>
    </div>
  );
}
