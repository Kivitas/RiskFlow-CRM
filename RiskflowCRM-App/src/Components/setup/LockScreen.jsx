import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBusiness } from '@/lib/BusinessContext';
import AppLogo from '@/components/shared/AppLogo';

export default function LockScreen() {
  const { profile, unlockApp } = useBusiness();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const result = unlockApp(password);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setError('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] p-8 text-center">
        <AppLogo src={profile.logoDataUrl} alt={profile.companyName || 'RiskFlow CRM'} className="mx-auto mb-5 h-20 w-20 rounded-lg" />
        <h1 className="text-2xl font-bold text-card-foreground">{profile.companyName || 'Workspace Locked'}</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">Enter the local app password to continue.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="App password"
            autoFocus
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full">Unlock App</Button>
        </form>
      </div>
    </div>
  );
}
