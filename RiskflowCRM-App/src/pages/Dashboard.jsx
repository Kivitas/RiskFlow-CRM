import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import {
  ArrowUpRight,
  BadgeDollarSign,
  Boxes,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FilePlus2,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  UserPlus,
  Users,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { crmClient } from '@/api/crmClient';
import { useAuth } from '@/lib/AuthContext';
import { useBusiness } from '@/lib/BusinessContext';
import { SUPPORTED_CURRENCIES, useCurrency } from '@/lib/CurrencyContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const CHART_COLORS = {
  blue: '#2563eb',
  green: '#16a34a',
  amber: '#f59e0b',
  cyan: '#0891b2',
  purple: '#7c3aed',
  red: '#ef4444',
};

const safeDate = (value) => {
  if (!value) {
    return null;
  }
  try {
    return parseISO(value);
  } catch {
    return null;
  }
};

const isWithinRange = (value, start, end) => {
  const date = safeDate(value);
  if (!date) {
    return false;
  }
  return !isBefore(date, start) && !isAfter(date, end);
};

const sumBy = (items, picker) => items.reduce((sum, item) => sum + Number(picker(item) || 0), 0);

const trendMeta = (current, previous) => {
  if (!previous) {
    return { value: current > 0 ? 100 : 0, positive: current >= 0 };
  }
  const delta = ((current - previous) / previous) * 100;
  return { value: Math.abs(delta), positive: delta >= 0 };
};

function MiniSparkline({ data, color }) {
  if (!data.length) {
    return <div className="h-12 w-full rounded-2xl bg-slate-50" />;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-12 w-full overflow-visible">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function HeaderControl({ children, className = '', onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60',
        className
      )}
    >
      {children}
    </button>
  );
}

function HeroMetric({ icon: Icon, label, value, trend, trendPositive, spark, color }) {
  return (
    <div className="grid grid-cols-[44px_1fr_140px] items-center gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="mt-1 flex items-end gap-2">
          <p className="text-[1.65rem] font-semibold tracking-tight text-slate-950">{value}</p>
          <span className={cn('mb-1 text-sm font-semibold', trendPositive ? 'text-emerald-600' : 'text-red-500')}>
            {trendPositive ? '+' : '-'} {trend.toFixed(1)}%
          </span>
        </div>
      </div>
      <MiniSparkline data={spark} color={color} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, foot, color, trend, trendPositive }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}16` }}>
          <Icon className="h-5 w-5" style={{ color }} />
        </div>
        <div className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', trendPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500')}>
          {trendPositive ? '+' : '-'} {trend.toFixed(1)}%
        </div>
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
      <p className="mt-4 text-sm font-medium" style={{ color }}>{foot}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, color, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}14` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <span>{label}</span>
    </button>
  );
}

function PanelCard({ title, subtitle, right, children }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.35)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ActivityItem({ title, note, time, color }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3">
      <div className="mt-0.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="mt-1 truncate text-xs text-slate-500">{note}</p>
      </div>
      <span className="text-xs font-medium text-slate-400">{time}</span>
    </div>
  );
}

function SnapshotItem({ label, value, note, color }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{note}</p>
        </div>
        <span className="text-lg font-semibold" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}

function FxRateCard({ code, symbol, value, selected }) {
  return (
    <div className={cn(
      'rounded-2xl border px-4 py-3 shadow-sm',
      selected ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold',
          selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
        )}>
          {symbol}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{code}</p>
          <p className="text-xs text-slate-500">vs USD</p>
        </div>
      </div>
      <p className="mt-3 text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useBusiness();
  const {
    currency,
    currencyInfo,
    rates,
    ratesLoading,
    ratesSource,
    lastUpdated,
    fetchRates,
    formatMoney,
    formatMoneyCompact,
    formatConvertedMoney,
  } = useCurrency();

  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => crmClient.entities.Contact.list() });
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => crmClient.entities.Deal.list() });
  const { data: risks = [] } = useQuery({ queryKey: ['risks'], queryFn: () => crmClient.entities.RiskAssessment.list() });
  const { data: activities = [] } = useQuery({ queryKey: ['activities'], queryFn: () => crmClient.entities.Activity.list('-created_date', 8) });
  const { data: onboarding = [] } = useQuery({ queryKey: ['onboarding'], queryFn: () => crmClient.entities.OnboardingClient.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => crmClient.products.list() });
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => crmClient.sales.list('-sale_date', 100) });
  const { data: purchaseOrders = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => crmClient.purchases.list('-order_date', 100) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => crmClient.expenses.list('-expense_date', 100) });
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes'], queryFn: () => crmClient.quotes.list('-quote_date', 100) });
  const { data: salesOrders = [] } = useQuery({ queryKey: ['sales-orders'], queryFn: () => crmClient.salesOrders.list('-order_date', 100) });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => crmClient.payments.list('-payment_date', 100) });
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: () => crmClient.approvals.list('-created_date', 50) });

  const now = new Date();
  const last30Start = subDays(now, 29);
  const prev30Start = subDays(last30Start, 30);
  const prev30End = subDays(last30Start, 1);
  const completedSales = sales.filter((sale) => sale.payment_status !== 'refunded');
  const customers = contacts.filter((contact) => contact.status === 'customer').length;
  const activeDeals = deals.filter((deal) => !['closed_won', 'closed_lost'].includes(deal.stage));
  const wonDeals = deals.filter((deal) => deal.stage === 'closed_won');
  const activeOnboarding = onboarding.filter((item) => item.onboarding_stage !== 'completed').length;
  const openApprovals = approvals.filter((approval) => approval.status === 'pending').length;
  const criticalRisks = risks.filter((risk) => ['critical', 'high'].includes(risk.severity)).length;
  const lowStockCount = products.filter((product) => product.status === 'active' && Number(product.stock_quantity || 0) <= Number(product.reorder_level || 0)).length;
  const outOfStock = products.filter((product) => product.status === 'active' && Number(product.stock_quantity || 0) === 0).length;
  const inventoryValue = sumBy(products, (product) => product.inventory_value);
  const pipelineValue = sumBy(activeDeals, (deal) => deal.value);
  const salesRevenue = sumBy(completedSales, (sale) => sale.total_amount);
  const wonRevenue = sumBy(wonDeals, (deal) => deal.value);
  const cashCollected = sumBy(payments, (payment) => payment.amount);
  const expenseTotal = sumBy(expenses, (expense) => expense.amount);
  const supplierSpend = sumBy(purchaseOrders.filter((order) => order.payment_status === 'paid'), (order) => order.total_amount);
  const grossProfit = completedSales.reduce((sum, sale) => {
    const product = products.find((item) => item.id === sale.product_id);
    return sum + ((Number(sale.unit_price || 0) - Number(product?.cost_price || 0)) * Number(sale.quantity || 0));
  }, 0);

  const revenue30 = sumBy(
    completedSales.filter((sale) => isWithinRange(sale.sale_date, last30Start, now)),
    (sale) => sale.total_amount
  );
  const revenuePrev30 = sumBy(
    completedSales.filter((sale) => isWithinRange(sale.sale_date, prev30Start, prev30End)),
    (sale) => sale.total_amount
  );
  const contacts30 = contacts.filter((contact) => isWithinRange(contact.created_date, last30Start, now)).length;
  const contactsPrev30 = contacts.filter((contact) => isWithinRange(contact.created_date, prev30Start, prev30End)).length;
  const orders30 = salesOrders.filter((order) => isWithinRange(order.order_date, last30Start, now)).length;
  const ordersPrev30 = salesOrders.filter((order) => isWithinRange(order.order_date, prev30Start, prev30End)).length;
  const receipts30 = payments.filter((payment) => isWithinRange(payment.payment_date, last30Start, now)).length;
  const receiptsPrev30 = payments.filter((payment) => isWithinRange(payment.payment_date, prev30Start, prev30End)).length;

  const revenueTrend = trendMeta(revenue30, revenuePrev30);
  const contactsTrend = trendMeta(contacts30, contactsPrev30);
  const ordersTrend = trendMeta(orders30, ordersPrev30);
  const receiptsTrend = trendMeta(receipts30, receiptsPrev30);

  const healthSignals = [
    activeDeals.length > 0,
    lowStockCount === 0,
    openApprovals === 0,
    criticalRisks <= 2,
    receipts30 > 0,
    customers > 0,
  ].filter(Boolean).length;
  const healthScore = Math.round((healthSignals / 6) * 100);

  const revenueMonthly = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(now, 5 - index);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const monthlySalesRevenue = sumBy(
      completedSales.filter((sale) => isWithinRange(sale.sale_date, monthStart, monthEnd)),
      (sale) => sale.total_amount
    );
    const monthlyWonRevenue = sumBy(
      wonDeals.filter((deal) => isWithinRange(deal.updated_date || deal.created_date, monthStart, monthEnd)),
      (deal) => deal.value
    );
    const monthlyPurchases = sumBy(
      purchaseOrders.filter((order) => isWithinRange(order.order_date, monthStart, monthEnd)),
      (order) => order.total_amount
    );
    const monthlyExpenses = sumBy(
      expenses.filter((expense) => isWithinRange(expense.expense_date, monthStart, monthEnd)),
      (expense) => expense.amount
    );

    return {
      month: format(month, 'MMM'),
      Revenue: monthlySalesRevenue + monthlyWonRevenue,
      Profit: monthlySalesRevenue + monthlyWonRevenue - monthlyPurchases - monthlyExpenses,
    };
  }), [completedSales, expenses, now, purchaseOrders, wonDeals]);

  const salesOrdersMonthly = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(now, 5 - index);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);

    return {
      month: format(month, 'MMM'),
      Sales: completedSales.filter((sale) => isWithinRange(sale.sale_date, monthStart, monthEnd)).length,
      Orders: salesOrders.filter((order) => isWithinRange(order.order_date, monthStart, monthEnd)).length,
    };
  }), [completedSales, now, salesOrders]);

  const sparkRevenue = revenueMonthly.map((item) => item.Revenue);
  const sparkContacts = Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(now, 5 - index);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return contacts.filter((contact) => isWithinRange(contact.created_date, monthStart, monthEnd)).length;
  });
  const sparkOrders = salesOrdersMonthly.map((item) => item.Orders);

  const snapshotItems = [
    { label: 'Low Stock Items', value: lowStockCount, note: `${products.length} products monitored`, color: CHART_COLORS.amber },
    { label: 'Out of Stock', value: outOfStock, note: 'Items unavailable for sale', color: CHART_COLORS.red },
    { label: 'High Risks', value: criticalRisks, note: 'Records flagged for review', color: '#f97316' },
    { label: 'Open Approvals', value: openApprovals, note: `${quotes.length} quotes and ${purchaseOrders.length} POs in flow`, color: CHART_COLORS.purple },
  ];

  const recentActivity = activities.slice(0, 5).map((activity, index) => ({
    id: activity.id || index,
    title: activity.title || activity.activity_type || 'Workspace activity',
    note: activity.description || activity.notes || activity.related_name || 'Updated operational record',
    time: activity.created_date ? format(safeDate(activity.created_date) || now, 'h:mm a') : 'Just now',
    color: [CHART_COLORS.blue, CHART_COLORS.green, CHART_COLORS.cyan, CHART_COLORS.amber, CHART_COLORS.purple][index % 5],
  }));

  const fxPreview = SUPPORTED_CURRENCIES.filter((item) => item.code !== 'USD').slice(0, 10);

  const topCards = [
    {
      icon: BadgeDollarSign,
      label: 'Revenue (Month)',
      value: formatMoney(revenue30),
      detail: `${completedSales.length} recorded sales`,
      foot: `${revenueTrend.positive ? '+' : '-'}${revenueTrend.value.toFixed(1)}% vs previous 30 days`,
      color: CHART_COLORS.green,
      trend: revenueTrend.value,
      trendPositive: revenueTrend.positive,
    },
    {
      icon: TrendingUp,
      label: 'Pipeline Value',
      value: formatMoney(pipelineValue),
      detail: `${activeDeals.length} open deals`,
      foot: `${wonDeals.length} deals closed won`,
      color: CHART_COLORS.blue,
      trend: trendMeta(activeDeals.length, Math.max(activeDeals.length - 1, 0)).value,
      trendPositive: true,
    },
    {
      icon: Users,
      label: 'Total Contacts',
      value: contacts.length.toLocaleString(),
      detail: `${customers} customers in workspace`,
      foot: `${contactsTrend.positive ? '+' : '-'}${contactsTrend.value.toFixed(1)}% vs previous 30 days`,
      color: CHART_COLORS.purple,
      trend: contactsTrend.value,
      trendPositive: contactsTrend.positive,
    },
    {
      icon: Boxes,
      label: 'Inventory Value',
      value: formatMoney(inventoryValue),
      detail: `${lowStockCount} low stock items`,
      foot: `${products.length} active products`,
      color: CHART_COLORS.amber,
      trend: trendMeta(lowStockCount, Math.max(lowStockCount + 2, 1)).value,
      trendPositive: false,
    },
    {
      icon: WalletCards,
      label: 'Cash In (Month)',
      value: formatMoney(sumBy(payments.filter((payment) => isWithinRange(payment.payment_date, last30Start, now)), (payment) => payment.amount)),
      detail: `${receipts30} receipts posted`,
      foot: `${receiptsTrend.positive ? '+' : '-'}${receiptsTrend.value.toFixed(1)}% vs previous 30 days`,
      color: CHART_COLORS.cyan,
      trend: receiptsTrend.value,
      trendPositive: receiptsTrend.positive,
    },
    {
      icon: ClipboardCheck,
      label: 'Open Approvals',
      value: openApprovals.toLocaleString(),
      detail: `${activeOnboarding} onboarding cases in progress`,
      foot: openApprovals > 0 ? `${openApprovals} require action` : 'No pending approvals',
      color: CHART_COLORS.purple,
      trend: trendMeta(openApprovals, Math.max(openApprovals + 1, 1)).value,
      trendPositive: false,
    },
  ];

  const quickActions = [
    { label: 'Add New Contact', icon: UserPlus, color: CHART_COLORS.blue, to: '/contacts' },
    { label: 'Create Quote', icon: FilePlus2, color: '#4f46e5', to: '/sales' },
    { label: 'Record Sale', icon: ShoppingCart, color: CHART_COLORS.green, to: '/inventory' },
    { label: 'Add Purchase Order', icon: PackagePlus, color: '#ea580c', to: '/procurement' },
    { label: 'Record Payment', icon: ReceiptText, color: CHART_COLORS.cyan, to: '/sales' },
    { label: 'View Reports', icon: ArrowUpRight, color: CHART_COLORS.purple, to: '/reports' },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[2rem] font-semibold tracking-tight text-slate-950">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back, {user?.first_name || user?.full_name || 'Admin'}. Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <HeaderControl>
            <CalendarDays className="h-4 w-4 text-slate-500" />
            {format(now, 'MMM d, yyyy')}
          </HeaderControl>
          <HeaderControl>
            {currencyInfo.symbol} {currency}
          </HeaderControl>
          <HeaderControl onClick={() => fetchRates(true)} disabled={ratesLoading}>
            <RefreshCw className={cn('h-4 w-4 text-slate-500', ratesLoading && 'animate-spin')} />
          </HeaderControl>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.08),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] p-6 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)]">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="flex gap-4">
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#2563eb,#1d4ed8)] shadow-[0_20px_35px_-24px_rgba(37,99,235,0.85)]">
                <Building2 className="h-10 w-10 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[1.8rem] font-semibold tracking-tight text-slate-950">{profile.companyName || 'RiskFlow CRM'}</h2>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">Active</span>
                </div>
                <p className="mt-2 text-xl font-medium text-slate-800">Business Overview</p>
                <p className="mt-2 text-sm text-slate-500">
                  {openApprovals === 0 && lowStockCount === 0 ? 'You are all set. Keep up the operational pace.' : 'A few areas need attention before they become blockers.'}
                </p>
                <p className="mt-5 text-sm text-slate-500">{profile.companyAddress || 'Workspace address not configured'}</p>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-100 bg-white/85 p-5">
              <p className="text-lg font-semibold text-slate-900">Business Health Score</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-6xl font-semibold leading-none text-emerald-600">{healthScore}</span>
                <span className="mb-2 text-2xl text-slate-500">/100</span>
                <span className="mb-2 ml-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-600">
                  {healthScore >= 70 ? 'Good' : healthScore >= 45 ? 'Monitor' : 'Attention'}
                </span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-[linear-gradient(90deg,#22c55e,#10b981)]" style={{ width: `${healthScore}%` }} />
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {openApprovals > 0 ? `${openApprovals} open approvals are dragging the score down.` : 'Approvals are clear and stock coverage is stable.'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)]">
          <HeroMetric
            icon={TrendingUp}
            label="Revenue (30D)"
            value={formatMoney(revenue30)}
            trend={revenueTrend.value}
            trendPositive={revenueTrend.positive}
            spark={sparkRevenue}
            color={CHART_COLORS.green}
          />
          <HeroMetric
            icon={Users}
            label="New Contacts (30D)"
            value={contacts30.toLocaleString()}
            trend={contactsTrend.value}
            trendPositive={contactsTrend.positive}
            spark={sparkContacts}
            color={CHART_COLORS.blue}
          />
          <HeroMetric
            icon={ShoppingCart}
            label="Orders (30D)"
            value={orders30.toLocaleString()}
            trend={ordersTrend.value}
            trendPositive={ordersTrend.positive}
            spark={sparkOrders}
            color={CHART_COLORS.amber}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-6">
        {topCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <PanelCard title="Quick Actions" subtitle="Move directly into the most common business tasks.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {quickActions.map((action) => (
            <ActionButton key={action.label} {...action} onClick={() => navigate(action.to)} />
          ))}
        </div>
      </PanelCard>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_1fr_0.8fr]">
        <PanelCard
          title="Revenue Overview"
          subtitle="Revenue and operating result over the last six months"
          right={<span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">This Year</span>}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueMonthly} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.blue} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.green} stopOpacity={0.16} />
                    <stop offset="95%" stopColor={CHART_COLORS.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => formatMoneyCompact(value)} />
                <Tooltip
                  formatter={(value) => formatMoney(value)}
                  contentStyle={{ borderRadius: 16, borderColor: '#e2e8f0', boxShadow: '0 18px 40px -28px rgba(15,23,42,0.35)' }}
                />
                <Area type="monotone" dataKey="Revenue" stroke={CHART_COLORS.blue} strokeWidth={3} fill="url(#revenueFill)" />
                <Area type="monotone" dataKey="Profit" stroke={CHART_COLORS.green} strokeWidth={3} fill="url(#profitFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard
          title="Sales & Orders"
          subtitle="Closed sales against booked orders"
          right={<span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">This Year</span>}
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesOrdersMonthly} margin={{ top: 10, right: 8, left: -20, bottom: 0 }} barGap={10}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 16, borderColor: '#e2e8f0', boxShadow: '0 18px 40px -28px rgba(15,23,42,0.35)' }} />
                <Bar dataKey="Sales" fill={CHART_COLORS.blue} radius={[8, 8, 0, 0]} />
                <Bar dataKey="Orders" fill={CHART_COLORS.green} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>

        <div className="space-y-5">
          <PanelCard title="Recent Activity">
            <div className="space-y-3">
              {recentActivity.length ? recentActivity.map((item) => (
                <ActivityItem key={item.id} {...item} />
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  No recent activity yet.
                </div>
              )}
            </div>
          </PanelCard>

          <PanelCard title="Inventory & Risk Snapshot">
            <div className="space-y-3">
              {snapshotItems.map((item) => (
                <SnapshotItem key={item.label} {...item} />
              ))}
            </div>
          </PanelCard>
        </div>
      </section>

      <PanelCard
        title="Exchange Rates (vs USD)"
        subtitle={lastUpdated ? `Updated ${format(lastUpdated, 'h:mm a')}` : ratesSource === 'fallback' ? 'Using offline fallback rates' : 'Live rates'}
        right={
          <Button variant="outline" className="rounded-xl border-slate-200 bg-white" onClick={() => fetchRates(true)} disabled={ratesLoading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', ratesLoading && 'animate-spin')} />
            Refresh
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {fxPreview.map((item) => (
            <FxRateCard
              key={item.code}
              code={item.code}
              symbol={item.symbol}
              value={formatConvertedMoney(Number(rates?.[item.code] || 0), item.code)}
              selected={item.code === currency}
            />
          ))}
        </div>
      </PanelCard>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold text-slate-900">Closed Revenue</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatMoney(wonRevenue)}</p>
          <p className="mt-2 text-sm text-slate-500">{activeDeals.length} deals still in pipeline</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold text-slate-900">Supplier Spend</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatMoney(supplierSpend)}</p>
          <p className="mt-2 text-sm text-slate-500">{purchaseOrders.length} purchase orders processed</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold text-slate-900">Operating Costs</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatMoney(expenseTotal)}</p>
          <p className="mt-2 text-sm text-slate-500">{expenses.length} expenses recorded</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
          <p className="text-sm font-semibold text-slate-900">Gross Profit</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{formatMoney(grossProfit)}</p>
          <p className="mt-2 text-sm text-slate-500">{formatMoney(cashCollected)} cash collected so far</p>
        </div>
      </section>
    </div>
  );
}
