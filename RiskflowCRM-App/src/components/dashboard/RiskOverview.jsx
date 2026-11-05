import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['hsl(0, 72%, 55%)', 'hsl(38, 92%, 55%)', 'hsl(230, 65%, 52%)', 'hsl(172, 60%, 42%)'];

export default function RiskOverview({ risks }) {
  const severityCounts = {
    critical: risks.filter(r => r.severity === 'critical').length,
    high: risks.filter(r => r.severity === 'high').length,
    medium: risks.filter(r => r.severity === 'medium').length,
    low: risks.filter(r => r.severity === 'low').length,
  };

  const data = [
    { name: 'Critical', value: severityCounts.critical || 0 },
    { name: 'High', value: severityCounts.high || 0 },
    { name: 'Medium', value: severityCounts.medium || 0 },
    { name: 'Low', value: severityCounts.low || 0 },
  ].filter(d => d.value > 0);

  const total = risks.length;

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">Risk Distribution</h3>
        <p className="text-xs text-muted-foreground mt-0.5">By severity level</p>
      </div>
      
      {data.length > 0 ? (
        <div className="flex items-center gap-6">
          <div className="w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} innerRadius={36} outerRadius={56} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5 flex-1">
            {[
              { label: 'Critical', count: severityCounts.critical, color: COLORS[0] },
              { label: 'High', count: severityCounts.high, color: COLORS[1] },
              { label: 'Medium', count: severityCounts.medium, color: COLORS[2] },
              { label: 'Low', count: severityCounts.low, color: COLORS[3] },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                <span className="text-xs font-semibold text-card-foreground">{item.count}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Risks</span>
                <span className="text-sm font-bold text-card-foreground">{total}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">No risks assessed yet</p>
      )}
    </div>
  );
}