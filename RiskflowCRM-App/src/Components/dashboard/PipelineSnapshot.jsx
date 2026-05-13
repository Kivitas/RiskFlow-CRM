import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/lib/CurrencyContext';

// Currency-aware pipeline snapshot with correct formatting
const stages = [
  { key: 'discovery',   label: 'Discovery',    color: 'bg-blue-500' },
  { key: 'proposal',    label: 'Proposal',     color: 'bg-indigo-500' },
  { key: 'negotiation', label: 'Negotiation',  color: 'bg-amber-500' },
  { key: 'closed_won',  label: 'Won',          color: 'bg-emerald-500' },
  { key: 'closed_lost', label: 'Lost',         color: 'bg-red-500' },
];

export default function PipelineSnapshot({ deals }) {
  const { formatMoneyCompact } = useCurrency();

  const stageData = stages.map((stage) => ({
    ...stage,
    count: deals.filter((d) => d.stage === stage.key).length,
    value: deals.filter((d) => d.stage === stage.key).reduce((sum, d) => sum + (d.value || 0), 0),
  }));

  const maxValue = Math.max(...stageData.map((s) => s.value), 1);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">Pipeline Snapshot</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Deal value by stage</p>
      </div>
      {deals.length === 0 ? (
        <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">No deals yet</div>
      ) : (
        <div className="space-y-3">
          {stageData.map((stage) => (
            <div key={stage.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-card-foreground">{stage.label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{stage.count} deal{stage.count !== 1 ? 's' : ''}</span>
                  <span className="text-xs font-bold text-card-foreground w-16 text-right">{formatMoneyCompact(stage.value)}</span>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', stage.color)}
                  style={{ width: `${(stage.value / maxValue) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
