import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const tooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-card-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.fill }}>{entry.name}: <b>{entry.value}</b></p>
      ))}
    </div>
  );
};

export default function InventoryHealthChart({ products }) {
  const data = products
    .slice()
    .sort((left, right) => Number(right.stock_quantity || 0) - Number(left.stock_quantity || 0))
    .slice(0, 6)
    .map((product) => ({
      name: product.name,
      Stock: Number(product.stock_quantity || 0),
      Reorder: Number(product.reorder_level || 0),
    }));

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-card-foreground">Inventory Health</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Top products by stock on hand</p>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-muted-foreground">No inventory yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 0, right: 0, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={tooltip} />
            <Bar dataKey="Stock" fill="hsl(230,65%,52%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Reorder" fill="hsl(38,92%,55%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
