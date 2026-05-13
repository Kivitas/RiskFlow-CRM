import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import { useCurrency } from '@/lib/CurrencyContext';
import { useBusiness } from '@/lib/BusinessContext';
import { Button } from '@/components/ui/button';
import { exportRowsToCsv, exportRowsToOds, exportRowsToPdf } from '@/lib/dataPortability';
import { buildReportMessage, openEmailWorkflow, openWhatsAppWorkflow } from '@/lib/workflowLinks';
import { Download, FileSpreadsheet, Mail, MessageCircle } from 'lucide-react';

const COLORS = ['hsl(230,65%,52%)', 'hsl(172,60%,42%)', 'hsl(38,92%,55%)', 'hsl(280,55%,55%)', 'hsl(0,72%,55%)', 'hsl(200,60%,50%)'];

const safeParse = (d) => { try { return parseISO(d); } catch { return new Date(0); } };

const ChartCard = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-card rounded-xl border border-border p-5 ${className}`}>
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

export default function Reports() {
  const { formatMoney } = useCurrency();
  const { profile } = useBusiness();

  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => crmClient.entities.Contact.list() });
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => crmClient.entities.Deal.list() });
  const { data: risks = [] } = useQuery({ queryKey: ['risks'], queryFn: () => crmClient.entities.RiskAssessment.list() });
  const { data: onboarding = [] } = useQuery({ queryKey: ['onboarding'], queryFn: () => crmClient.entities.OnboardingClient.list() });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => crmClient.products.list() });
  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => crmClient.sales.list() });
  const { data: purchaseOrders = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => crmClient.purchases.list() });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => crmClient.expenses.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes'], queryFn: () => crmClient.quotes.list() });
  const { data: salesOrders = [] } = useQuery({ queryKey: ['sales-orders'], queryFn: () => crmClient.salesOrders.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => crmClient.payments.list() });
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: () => crmClient.approvals.list() });
  const completedSales = sales.filter((sale) => sale.payment_status !== 'refunded');

  const isEmpty = contacts.length === 0 && deals.length === 0 && risks.length === 0 && products.length === 0
    && sales.length === 0 && purchaseOrders.length === 0 && expenses.length === 0
    && quotes.length === 0 && salesOrders.length === 0 && payments.length === 0 && approvals.length === 0;

  // Currency-aware tooltip
  const Tip = ({ active, payload, label, dollar }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {p.name}: <b>{dollar && p.value > 100 ? formatMoney(p.value) : p.value}</b>
          </p>
        ))}
      </div>
    );
  };

  // KPIs
  const wonDeals = deals.filter(d => d.stage === 'closed_won');
  const lostDeals = deals.filter(d => d.stage === 'closed_lost');
  const closedTotal = wonDeals.length + lostDeals.length;
  const winRate = closedTotal > 0 ? Math.round((wonDeals.length / closedTotal) * 100) : 0;
  const avgDealSize = deals.length > 0 ? Math.round(deals.reduce((s, d) => s + (d.value || 0), 0) / deals.length) : 0;
  const totalRevenue = wonDeals.reduce((s, d) => s + (d.value || 0), 0);
  const openRisks = risks.filter(r => r.status !== 'resolved' && r.status !== 'accepted').length;
  const inventoryValue = products.reduce((sum, p) => sum + Number(p.inventory_value || 0), 0);
  const salesRevenue = completedSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const lowStockProducts = products.filter((p) => p.status === 'active' && Number(p.stock_quantity || 0) <= Number(p.reorder_level || 0));
  const lowStockCount = lowStockProducts.length;
  const expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const purchaseTotal = purchaseOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const operatingResult = totalRevenue + salesRevenue - expenseTotal - purchaseTotal;
  const quoteValue = quotes.reduce((sum, q) => sum + Number(q.total_amount || 0), 0);
  const orderValue = salesOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const cashCollected = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const approvalBacklog = approvals.filter(a => a.status === 'pending').length;

  const stageData = ['discovery', 'proposal', 'negotiation', 'closed_won', 'closed_lost'].map(s => ({
    name: s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    Count: deals.filter(d => d.stage === s).length,
    Value: deals.filter(d => d.stage === s).reduce((sum, d) => sum + (d.value || 0), 0),
  }));

  const statusData = ['lead', 'prospect', 'customer', 'churned'].map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: contacts.filter(c => c.status === s).length,
  })).filter(d => d.value > 0);

  const sourceData = ['website', 'referral', 'cold_call', 'event', 'social_media', 'other'].map(s => ({
    name: s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    Count: contacts.filter(c => c.source === s).length,
  })).filter(d => d.Count > 0);

  const riskCatData = ['credit', 'market', 'operational', 'liquidity', 'compliance', 'strategic'].map(c => ({
    name: c.charAt(0).toUpperCase() + c.slice(1),
    Critical: risks.filter(r => r.category === c && r.severity === 'critical').length,
    High: risks.filter(r => r.category === c && r.severity === 'high').length,
    Medium: risks.filter(r => r.category === c && r.severity === 'medium').length,
    Low: risks.filter(r => r.category === c && r.severity === 'low').length,
  })).filter(d => d.Critical + d.High + d.Medium + d.Low > 0);

  const monthly = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const newContacts = contacts.filter(c => c.created_date && isWithinInterval(safeParse(c.created_date), interval)).length;
    const newDeals = deals.filter(d => d.created_date && isWithinInterval(safeParse(d.created_date), interval)).length;
    const revenue = deals.filter(d => d.stage === 'closed_won' && isWithinInterval(safeParse(d.updated_date || d.created_date), interval)).reduce((s, d) => s + (d.value || 0), 0);
    return { month: format(month, 'MMM'), Contacts: newContacts, Deals: newDeals, Revenue: revenue };
  });

  const kycData = ['pending', 'in_review', 'approved', 'rejected'].map(s => ({
    name: s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: onboarding.filter(o => o.kyc_status === s).length,
  })).filter(d => d.value > 0);

  const radarData = ['credit', 'market', 'operational', 'liquidity', 'compliance', 'strategic'].map(cat => {
    const catRisks = risks.filter(r => r.category === cat);
    const avgImpact = catRisks.length > 0 ? Math.round(catRisks.reduce((s, r) => s + (r.impact_score || 0), 0) / catRisks.length) : 0;
    return { category: cat.charAt(0).toUpperCase() + cat.slice(1), Impact: avgImpact };
  });

  const inventoryCategoryData = Object.values(
    products.reduce((acc, p) => {
      const key = p.category || 'general';
      acc[key] = acc[key] || { name: key.replace(/\b\w/g, l => l.toUpperCase()), value: 0 };
      acc[key].value += 1;
      return acc;
    }, {})
  );

  const stockValueData = products.slice().sort((a, b) => Number(b.inventory_value || 0) - Number(a.inventory_value || 0)).slice(0, 6).map(p => ({
    name: p.name,
    Stock: Number(p.stock_quantity || 0),
    Value: Number(p.inventory_value || 0),
  }));

  const salesMonthly = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const ms = completedSales.filter(s => s.sale_date && isWithinInterval(safeParse(s.sale_date), interval));
    return { month: format(month, 'MMM'), Orders: ms.length, Revenue: ms.reduce((s, x) => s + Number(x.total_amount || 0), 0) };
  });

  const financeMonthly = Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const me = expenses.filter(e => e.expense_date && isWithinInterval(safeParse(e.expense_date), interval));
    const mp = purchaseOrders.filter(o => o.order_date && isWithinInterval(safeParse(o.order_date), interval));
    return {
      month: format(month, 'MMM'),
      Expenses: me.reduce((s, x) => s + Number(x.amount || 0), 0),
      Purchases: mp.reduce((s, x) => s + Number(x.total_amount || 0), 0),
    };
  });

  const expenseCategoryData = Object.values(
    expenses.reduce((acc, e) => {
      const key = e.category || 'operations';
      acc[key] = acc[key] || { name: key.replace(/\b\w/g, l => l.toUpperCase()), value: 0 };
      acc[key].value += Number(e.amount || 0);
      return acc;
    }, {})
  );

  const kpiRows = [
    { label: 'Total Revenue', value: formatMoney(totalRevenue) },
    { label: 'Win Rate', value: `${winRate}%` },
    { label: 'Avg Deal Size', value: formatMoney(avgDealSize) },
    { label: 'Open Risks', value: openRisks },
    { label: 'Inventory Value', value: formatMoney(inventoryValue) },
    { label: 'Sales Revenue', value: formatMoney(salesRevenue) },
    { label: 'Low Stock', value: lowStockCount },
    { label: 'Products', value: products.length },
    { label: 'Expenses', value: formatMoney(expenseTotal) },
    { label: 'Purchases', value: formatMoney(purchaseTotal) },
    { label: 'Operating Result', value: formatMoney(operatingResult) },
    { label: 'Quotes', value: formatMoney(quoteValue) },
    { label: 'Sales Orders', value: formatMoney(orderValue) },
    { label: 'Cash Collected', value: formatMoney(cashCollected) },
    { label: 'Approval Backlog', value: approvalBacklog },
  ];

  const reportRows = [
    ...kpiRows.map((row) => ({ report: 'Executive Summary', metric: row.label, value: row.value })),
    ...lowStockProducts.map((product) => ({
      report: 'Inventory Risk',
      metric: product.name,
      value: `${product.stock_quantity} in stock, reorder at ${product.reorder_level}`,
    })),
    ...expenses.map((expense) => ({
      report: 'Expenses',
      metric: expense.title || expense.category || 'Expense',
      value: formatMoney(expense.amount || 0),
    })),
    ...completedSales.map((sale) => ({
      report: 'Sales',
      metric: sale.product_name || 'Sale',
      value: formatMoney(sale.total_amount || 0),
    })),
  ];

  const reportSummary = [
    `Revenue: ${formatMoney(totalRevenue + salesRevenue)}`,
    `Inventory value: ${formatMoney(inventoryValue)}`,
    `Low stock items: ${lowStockCount}`,
    `Open approvals: ${approvalBacklog}`,
    `Operating result: ${formatMoney(operatingResult)}`,
  ].join('\n');

  const reportActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => exportRowsToCsv(reportRows, 'riskflow-report')}>
        <Download className="mr-2 h-4 w-4" />CSV
      </Button>
      <Button variant="outline" onClick={() => exportRowsToOds(reportRows, 'riskflow-report')}>
        <FileSpreadsheet className="mr-2 h-4 w-4" />ODS
      </Button>
      <Button variant="outline" onClick={() => exportRowsToPdf({ rows: reportRows, label: 'riskflow-report', title: 'RiskFlow Business Report', subtitle: reportSummary })}>
        <Download className="mr-2 h-4 w-4" />PDF
      </Button>
      <Button variant="outline" onClick={() => openEmailWorkflow({ subject: 'Scheduled RiskFlow report', body: buildReportMessage({ profile, reportName: 'Business Report', summary: reportSummary }) })}>
        <Mail className="mr-2 h-4 w-4" />Email
      </Button>
      <Button variant="outline" onClick={() => openWhatsAppWorkflow({ message: buildReportMessage({ profile, reportName: 'Business Report', summary: reportSummary }) })}>
        <MessageCircle className="mr-2 h-4 w-4" />WhatsApp
      </Button>
    </div>
  );

  if (isEmpty) {
    return (
      <div>
        <PageHeader title="Reports & Analytics" subtitle="Insights across your entire platform" actions={reportActions} />
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <span className="text-2xl">📊</span>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">No data yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm">Add contacts, deals, and risks to start seeing powerful analytics and insights here.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Insights across your entire platform" actions={reportActions} />

      <div className="mb-5 rounded-2xl border border-blue-100 bg-[linear-gradient(135deg,#eff6ff,#ffffff)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Report Export & Workflow Center</h3>
            <p className="mt-1 text-sm text-slate-500">Download board-ready reports as PDF, CSV, or ODS, then trigger email/WhatsApp workflows for scheduled reporting.</p>
          </div>
          <div className="text-xs text-slate-500">
            Suggested schedule: weekly sales/inventory, monthly P&L/tax, daily overdue/low-stock alerts.
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        {kpiRows.map(k => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-2xl font-bold text-card-foreground">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Trends */}
      <ChartCard title="Monthly Activity Trends" subtitle="Contacts, deals, and revenue over the last 6 months" className="mb-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={monthly} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.15} /><stop offset="95%" stopColor={COLORS[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="r2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.15} /><stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Contacts" stroke={COLORS[0]} strokeWidth={2} fill="url(#r1)" />
            <Area type="monotone" dataKey="Deals" stroke={COLORS[1]} strokeWidth={2} fill="url(#r2)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Deal Pipeline" subtitle="Count per stage">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stageData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="Count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Contact Status" subtitle="Distribution by lifecycle stage">
          {statusData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={statusData} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5">
                {statusData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-bold text-card-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No contact data yet</p>}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Risks by Category & Severity" subtitle="Distribution across categories">
          {riskCatData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={riskCatData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Critical" stackId="a" fill="hsl(0,72%,55%)" />
                <Bar dataKey="High" stackId="a" fill="hsl(38,92%,55%)" />
                <Bar dataKey="Medium" stackId="a" fill="hsl(38,80%,68%)" />
                <Bar dataKey="Low" stackId="a" fill="hsl(172,60%,42%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No risk data yet</p>}
        </ChartCard>

        <ChartCard title="Risk Impact by Category" subtitle="Average impact score per category">
          {risks.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220,16%,90%)" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} />
                <Radar name="Avg Impact" dataKey="Impact" stroke="hsl(0,72%,55%)" fill="hsl(0,72%,55%)" fillOpacity={0.2} strokeWidth={2} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No risk data yet</p>}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Lead Sources" subtitle="Where your contacts come from">
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sourceData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="Count" fill={COLORS[3]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No contact data yet</p>}
        </ChartCard>

        <ChartCard title="KYC Status Distribution" subtitle="Onboarding verification status">
          {kycData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={kycData} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {kycData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5">
                {kycData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-bold text-card-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No onboarding data yet</p>}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ChartCard title="Inventory Category Mix" subtitle="Products by category">
          {inventoryCategoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={inventoryCategoryData} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {inventoryCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5">
                {inventoryCategoryData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-bold text-card-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No product data yet</p>}
        </ChartCard>

        <ChartCard title="Stock Value by Product" subtitle="Highest inventory value on hand">
          {stockValueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stockValueData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip dollar />} />
                <Bar dataKey="Value" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No product data yet</p>}
        </ChartCard>
      </div>

      <ChartCard title="Sales Trend" subtitle="Monthly order count and revenue — last 6 months" className="mb-4">
        {sales.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={salesMonthly} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="salesReportRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.15} /><stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="Orders" stroke={COLORS[0]} strokeWidth={2} fillOpacity={0} />
              <Area type="monotone" dataKey="Revenue" stroke={COLORS[1]} strokeWidth={2} fill="url(#salesReportRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground text-center py-16">No sales data yet</p>}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Expense Categories" subtitle="Operating cost breakdown">
          {expenseCategoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={expenseCategoryData} innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {expenseCategoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5">
                {expenseCategoryData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-bold text-card-foreground ml-auto">{formatMoney(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No expense data yet</p>}
        </ChartCard>

        <ChartCard title="Cost Movement" subtitle="Monthly expenses and procurement outflow">
          {(expenses.length > 0 || purchaseOrders.length > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={financeMonthly} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Tip dollar />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Expenses" fill={COLORS[3]} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Purchases" fill={COLORS[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-16">No accounting data yet</p>}
        </ChartCard>
      </div>
    </div>
  );
}
