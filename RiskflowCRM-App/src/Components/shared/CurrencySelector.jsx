import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe, RefreshCw, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { SUPPORTED_CURRENCIES, useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';

export default function CurrencySelector({ compact = false, className = '' }) {
  const {
    currency,
    setCurrency,
    currencyInfo,
    rates,
    ratesLoading,
    ratesError,
    ratesSource,
    lastUpdated,
    fetchRates,
    convertAmount,
    formatConvertedMoney,
  } = useCurrency();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) {
      return SUPPORTED_CURRENCIES;
    }
    const query = search.toLowerCase();
    return SUPPORTED_CURRENCIES.filter((item) =>
      item.code.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.symbol.toLowerCase().includes(query)
    );
  }, [search]);

  const statusLabel = useMemo(() => {
    if (ratesSource === 'live') {
      return `Live${lastUpdated ? ` | updated ${format(lastUpdated, 'HH:mm')}` : ''}`;
    }
    if (ratesSource === 'cache') {
      return 'Cached rates';
    }
    if (ratesError) {
      return 'Offline fallback rates';
    }
    return 'Fallback rates';
  }, [lastUpdated, ratesError, ratesSource]);

  const handleSelect = (code) => {
    setCurrency(code);
    setOpen(false);
    setSearch('');
  };

  const previewRate = currency === 'USD' ? 1 : convertAmount(1);

  if (compact) {
    return (
      <div ref={ref} className={cn('relative', className)}>
        <button
          onClick={() => setOpen((current) => !current)}
          title="Change display currency"
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Globe className="h-4 w-4 flex-shrink-0" />
          <span>{currencyInfo.code}</span>
          <span className="text-[10px] opacity-60">{currencyInfo.symbol}</span>
          <ChevronDown className={cn('ml-auto h-3 w-3 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            <div className="border-b border-border bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Display Currency</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{statusLabel}</p>
            </div>
            <div className="border-b border-border px-2 py-1.5">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1">
                <Search className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search currency..."
                  className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredCurrencies.length === 0 && (
                <p className="px-3 py-3 text-center text-xs text-muted-foreground">No currencies found</p>
              )}
              {filteredCurrencies.map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleSelect(item.code)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                    currency === item.code && 'bg-primary/10 font-semibold text-primary'
                  )}
                >
                  <span className="w-7 text-xs font-mono font-bold text-muted-foreground">{item.symbol}</span>
                  <span className="flex-1 truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.code}</span>
                  {currency === item.code && <Check className="h-3 w-3 flex-shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-card-foreground">Display Currency</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Monetary values are stored in USD and converted for display throughout the app.
          </p>
        </div>
        <button
          onClick={() => fetchRates(true)}
          title="Refresh exchange rates"
          className={cn('rounded-lg p-1.5 transition-colors hover:bg-muted', ratesLoading && 'pointer-events-none opacity-60')}
          disabled={ratesLoading}
        >
          <RefreshCw className={cn('h-4 w-4 text-muted-foreground', ratesLoading && 'animate-spin')} />
        </button>
      </div>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2.5 text-sm transition-colors hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{currencyInfo.symbol}</span>
            <span>{currencyInfo.name}</span>
            <span className="text-xs text-muted-foreground">({currencyInfo.code})</span>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            <div className="border-b border-border bg-muted/40 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Currency</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{statusLabel}</p>
            </div>
            <div className="border-b border-border px-2 py-1.5">
              <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1.5">
                <Search className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, code, or symbol..."
                  className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {filteredCurrencies.length === 0 && (
                <p className="px-4 py-4 text-center text-sm text-muted-foreground">No currencies match "{search}"</p>
              )}
              {filteredCurrencies.map((item) => (
                <button
                  key={item.code}
                  onClick={() => handleSelect(item.code)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted',
                    currency === item.code && 'bg-primary/10 font-semibold text-primary'
                  )}
                >
                  <span className="w-8 text-center text-sm font-bold text-muted-foreground">{item.symbol}</span>
                  <span className="flex-1">{item.name}</span>
                  <span className="text-xs font-mono text-muted-foreground">{item.code}</span>
                  {currency === item.code && <Check className="h-4 w-4 flex-shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {ratesLoading && (
          <>
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Fetching live rates from open.er-api.com...</span>
          </>
        )}
        {!ratesLoading && ratesSource === 'live' && (
          <span className="text-emerald-600">{statusLabel}</span>
        )}
        {!ratesLoading && ratesSource === 'cache' && (
          <span className="text-blue-600">{statusLabel} | <button className="underline" onClick={() => fetchRates(true)}>refresh</button></span>
        )}
        {!ratesLoading && ratesSource === 'fallback' && (
          <span className="text-amber-600">{statusLabel} | <button className="underline" onClick={() => fetchRates(true)}>retry</button></span>
        )}
      </div>

      {!ratesLoading && currency !== 'USD' && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          1 USD = <span className="font-semibold text-foreground">{formatConvertedMoney(previewRate)}</span>
          {' | '}
          <span className="text-muted-foreground">rates auto-refresh every 4 hours</span>
          {rates?.[currency] ? <span className="ml-2 text-muted-foreground">({rates[currency].toFixed(4)})</span> : null}
        </div>
      )}
    </div>
  );
}
