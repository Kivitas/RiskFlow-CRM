import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Jan', revenue: 42000, deals: 18 },
  { month: 'Feb', revenue: 38000, deals: 15 },
  { month: 'Mar', revenue: 55000, deals: 22 },
  { month: 'Apr', revenue: 47000, deals: 19 },
  { month: 'May', revenue: 63000, deals: 26 },
  { month: 'Jun', revenue: 58000, deals: 24 },
  { month: 'Jul', revenue: 71000, deals: 29 },
  { month: 'Aug', revenue: 65000, deals: 27 },
  { month: 'Sep', revenue: 78000, deals: 32 },
  { month: 'Oct', revenue: 82000, deals: 35 },
  { month: 'Nov', revenue: 91000, deals: 38 },
  { month: 'Dec', revenue: 87000, deals: 36 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {p.name}: <span className="font-semibold text-foreground">
              {p.name === 'revenue' ? `$${p.value.toLocaleString()}` : p.value}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenueChart() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">Revenue Overview</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Monthly revenue and deal count</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-accent" />
            <span className="text-muted-foreground">Deals</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(230, 65%, 52%)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="hsl(230, 65%, 52%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorDeals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(172, 60%, 42%)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="hsl(172, 60%, 42%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 16%, 90%)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220, 10%, 46%)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(220, 10%, 46%)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="revenue" stroke="hsl(230, 65%, 52%)" strokeWidth={2} fill="url(#colorRevenue)" />
          <Area type="monotone" dataKey="deals" stroke="hsl(172, 60%, 42%)" strokeWidth={2} fill="url(#colorDeals)" yAxisId={0} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}