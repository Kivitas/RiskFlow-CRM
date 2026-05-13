import React from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from 'date-fns';
import { useCurrency } from '@/lib/CurrencyContext';

const tooltip = ({ active, payload, label, formatMoneyCompact }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-card-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.stroke }}>
          {entry.name}: <b>{entry.name === 'Revenue' ? formatMoneyCompact(entry.value) : entry.value}</b>
        </p>
      ))}
    </div>
  );
};

export default function SalesPerformanceChart({ sales }) {
  const { formatMoneyCompact } = useCurrency();
  const completedSales = sales.filter((sale) => sale.payment_status !== 'refunded');
  const data = Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(new Date(), 5 - index);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const monthSales = completedSales.filter((sale) => {
      if (!sale.sale_date) return false;
      try {
        return isWithinInterval(parseISO(sale.sale_date), interval);
      } catch {
        return false;
      }
    });
    return {
      month: format(month, 'MMM'),
      Revenue: monthSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0),
      Orders: monthSales.length,
    };
  });

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">Sales Performance</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Orders and revenue over the last 6 months</p>
      </div>
      {completedSales.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No sales recorded yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(172,60%,42%)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="hsl(172,60%,42%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={(props) => tooltip({ ...props, formatMoneyCompact })} />
            <Area type="monotone" dataKey="Revenue" stroke="hsl(172,60%,42%)" strokeWidth={2} fill="url(#salesRevenue)" />
            <Area type="monotone" dataKey="Orders" stroke="hsl(230,65%,52%)" strokeWidth={2} fillOpacity={0} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
