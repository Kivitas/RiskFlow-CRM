import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBusiness } from '@/lib/BusinessContext';
import { crmClient } from '@/api/crmClient';
import AppLogo from '@/components/shared/AppLogo';

const RESET_CONFIRM_WORD = 'RESET';

export default function LockScreen() {
  const { profile, unlockApp } = useBusiness();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  // Forgotten lock password: the only way forward is to erase the workspace. The lock cannot be
  // bypassed here, so this path requires typing RESET to confirm.
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetInput, setResetInput] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const openResetPanel = () => {
    setIsResetOpen((open) => !open);
    setResetInput('');
    setResetError('');
  };

  const handleResetWorkspace = async (event) => {
    event.preventDefault();
    if (resetInput.trim() !== RESET_CONFIRM_WORD) {
      setResetError(`Type ${RESET_CONFIRM_WORD} to confirm.`);
      return;
    }

    setIsResetting(true);
    try {
      await crmClient.backups.secureErase({ passes: 1 });
      window.location.reload();
    } catch (resetFailure) {
      setResetError(resetFailure.message || 'Could not erase the workspace.');
      setIsResetting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsChecking(true);
    try {
      const result = await unlockApp(password);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      setError('');
      setPassword('');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] p-8 text-center">
        <AppLogo src={profile.logoDataUrl} alt={profile.companyName || 'RiskFlow CRM'} className="mx-auto mb-5 h-20 w-20 rounded-lg" />
        <h1 className="text-2xl font-bold text-card-foreground">{profile.companyName || 'Workspace Locked'}</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">Enter the workspace lock password to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Label htmlFor="lock-password" className="sr-only">Workspace lock password</Label>
          <div className="relative">
            <Input
              id="lock-password"
              type={showPassword ? 'text' : 'password'}
              className="pr-10"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError('');
              }}
              placeholder="Workspace lock password"
              autoFocus
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
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={isChecking}>
            {isChecking ? 'Checking...' : 'Unlock App'}
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4 text-left">
          <button
            type="button"
            onClick={openResetPanel}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            aria-expanded={isResetOpen}
          >
            Forgot the lock password?
          </button>

          {isResetOpen && (
            <form onSubmit={handleResetWorkspace} className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs leading-5 text-muted-foreground">
                This permanently erases all data stored in this browser, then opens the sign-up screen.
              </p>
              <Label htmlFor="lock-reset-confirm" className="text-xs">
                Type {RESET_CONFIRM_WORD} to continue
              </Label>
              <Input
                id="lock-reset-confirm"
                type="text"
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
      </div>
    </div>
  );
}
