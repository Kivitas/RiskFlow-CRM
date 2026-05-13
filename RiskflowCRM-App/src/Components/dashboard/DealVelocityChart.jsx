import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useCurrency } from '@/lib/CurrencyContext';

const CustomTooltip = ({ active, payload, label, formatMoneyCompact }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-1.5">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: <span className="font-bold">{p.name.includes('Value') ? formatMoneyCompact(p.value) : p.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DealVelocityChart({ deals }) {
  const { formatMoneyCompact } = useCurrency();
  const data = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(new Date(), 5 - i);
      const interval = { start: startOfMonth(month), end: endOfMonth(month) };
      const monthDeals = deals.filter(d => {
        const date = new Date(d.created_date || d.expected_close_date);
        return isWithinInterval(date, interval);
      });
      const wonDeals = deals.filter(d => {
        const date = new Date(d.updated_date || d.created_date);
        return d.stage === 'closed_won' && isWithinInterval(date, interval);
      });
      return {
        month: format(month, 'MMM'),
        'New Deals': monthDeals.length,
        'Won Deals': wonDeals.length,
        'Pipeline Value': monthDeals.reduce((s, d) => s + (d.value || 0), 0),
        'Won Value': wonDeals.reduce((s, d) => s + (d.value || 0), 0),
      };
    });
  }, [deals]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-card-foreground">Deal Activity (6 Months)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">New vs closed deals over time</p>
      </div>
      {deals.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">No deal data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip formatMoneyCompact={formatMoneyCompact} />} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(220,10%,46%)' }} />
            <Bar dataKey="New Deals" fill="hsl(230,65%,52%)" radius={[4,4,0,0]} />
            <Bar dataKey="Won Deals" fill="hsl(172,60%,42%)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
