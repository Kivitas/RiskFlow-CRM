import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

const sev = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-green-100 text-green-700 border-green-200',
};
const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };

export default function TopRisksTable({ risks }) {
  const top = [...risks].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]).slice(0, 5);

  if (top.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <h3 className="text-sm font-semibold text-card-foreground">Top Active Risks</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Risk</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Category</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Severity</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Status</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Owner</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-2">Impact</th>
            </tr>
          </thead>
          <tbody>
            {top.map(r => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="py-3 pr-4 font-medium text-card-foreground max-w-[220px] truncate">{r.title}</td>
                <td className="py-3 pr-4 text-muted-foreground capitalize">{r.category}</td>
                <td className="py-3 pr-4"><Badge variant="outline" className={cn("text-[10px] capitalize", sev[r.severity])}>{r.severity}</Badge></td>
                <td className="py-3 pr-4 text-muted-foreground capitalize text-xs">{r.status?.replace('_',' ')}</td>
                <td className="py-3 pr-4 text-muted-foreground text-xs">{r.owner || '—'}</td>
                <td className="py-3 text-right font-bold text-card-foreground">{r.impact_score}/10</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}