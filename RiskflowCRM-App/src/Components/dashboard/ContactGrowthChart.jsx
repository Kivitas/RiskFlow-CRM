import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function ContactGrowthChart({ contacts }) {
  const data = useMemo(() => {
    let cumulative = 0;
    return Array.from({ length: 6 }, (_, i) => {
      const month = subMonths(new Date(), 5 - i);
      const interval = { start: startOfMonth(month), end: endOfMonth(month) };
      const newThisMonth = contacts.filter(c => {
        const d = new Date(c.created_date);
        return isWithinInterval(d, interval);
      }).length;
      cumulative += newThisMonth;
      return { month: format(month, 'MMM'), New: newThisMonth, Total: cumulative };
    });
  }, [contacts]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
          <p className="font-semibold mb-1">{label}</p>
          {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>)}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-card-foreground">Contact Growth</h3>
        <p className="text-xs text-muted-foreground mt-0.5">New contacts added per month</p>
      </div>
      {contacts.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No contacts yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
            <defs>
              <linearGradient id="cgGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(230,65%,52%)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="hsl(230,65%,52%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="New" stroke="hsl(230,65%,52%)" strokeWidth={2} fill="url(#cgGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}