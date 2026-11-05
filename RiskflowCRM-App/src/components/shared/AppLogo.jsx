import React from 'react';
import { cn } from '@/lib/utils';

export default function AppLogo({ src, alt = 'RiskFlow CRM', className = '', imageClassName = '' }) {
  return (
    <div className={cn('overflow-hidden bg-slate-950 shadow-sm ring-1 ring-white/10', className)}>
      <img
        src={src || '/riskflow-logo.png'}
        alt={alt}
        className={cn('h-full w-full object-cover', imageClassName)}
        onError={(event) => {
          if (!event.currentTarget.dataset.fallback) {
            event.currentTarget.dataset.fallback = 'true';
            event.currentTarget.src = '/riskflow-logo.svg';
          }
        }}
      />
    </div>
  );
}
