import React from 'react';

export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-8 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}