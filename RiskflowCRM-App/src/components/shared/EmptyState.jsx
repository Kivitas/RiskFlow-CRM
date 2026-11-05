import React from 'react';
import { Button } from '@/components/ui/button';

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-4 py-12 text-center sm:py-16">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
      <h3 className="mb-1 break-words text-base font-semibold text-foreground">{title}</h3>
      {description && <p className="mb-4 max-w-sm break-words text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} size="sm">{actionLabel}</Button>
      )}
    </div>
  );
}