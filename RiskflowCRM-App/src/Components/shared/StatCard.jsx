import React from 'react';
import { cn } from '@/lib/utils';

export default function StatCard({ title, value, icon: Icon, iconBg, iconColor, sub, trend, emphasis = false }) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-34px_rgba(15,23,42,0.42)]',
        emphasis && 'bg-gradient-to-br from-white via-white to-slate-50'
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-50/70 to-transparent" />
      <div className="relative flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.22em]">{title}</p>
          {trend && <p className="mt-2 text-xs font-medium text-emerald-600">{trend}</p>}
        </div>
        {Icon && (
          <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
        )}
      </div>
      <p className="relative text-[2rem] font-bold leading-none tracking-tight text-slate-950">{value}</p>
      {sub && <p className="relative mt-3 text-sm leading-6 text-slate-500">{sub}</p>}
    </div>
  );
}
