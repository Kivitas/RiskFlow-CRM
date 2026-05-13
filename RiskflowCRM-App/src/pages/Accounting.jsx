import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ExpenseFormDialog from '@/Components/accounting/ExpenseFormDialog';
import { CreditCard, Landmark, MoreHorizontal, Plus, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(230,65%,52%)', 'hsl(172,60%,42%)', 'hsl(38,92%,55%)', 'hsl(0,72%,55%)', 'hsl(280,55%,55%)'];

// Safe ISO date parse to avoid crashes from invalid date strings
const safeParse = (dateStr) => {
  try { return parseISO(dateStr); } catch { return new Date(0); }
};

export default function Accounting() {
  const qc = useQueryClient();
  const { profile } = useBusiness();
  const { formatMoney } = useCurrency();
  const confirm = useConfirm();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const { data: sales = [] } = useQuery({ queryKey: ['sales'], queryFn: () => crmClient.sales.list('-sale_date') });
  const { data: deals = [] } = useQuery({ queryKey: ['deals'], queryFn: () => crmClient.entities.Deal.list('-updated_date') });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => crmClient.expenses.list('-expense_date') });
  const { data: purchaseOrders = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => crmClient.purchases.list('-order_date') });

  const expenseMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.expenses.update(id, data) : crmClient.expenses.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setExpenseDialogOpen(false);
      setEditingExpense(null);
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => crmClient.expenses.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  });

  const salesRevenue = sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const crmRevenue = deals.filter((deal) => deal.stage === 'closed_won').reduce((sum, deal) => sum + Number(deal.value || 0), 0);
  const totalRevenue = salesRevenue + crmRevenue;
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const purchaseOutflow = purchaseOrders.filter((order) => order.payment_status === 'paid').reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const pendingExpenses = expenses.filter((expense) => expense.payment_status !== 'paid').reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const pendingPurchases = purchaseOrders.filter((order) => order.payment_status !== 'paid').reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
  const operatingResult = totalRevenue - totalExpenses - purchaseOutflow;

  const expenseByCategory = useMemo(() => Object.values(
    expenses.reduce((accumulator, expense) => {
      const key = expense.category || 'operations';
      accumulator[key] = accumulator[key] || { name: key, value: 0 };
      accumulator[key].value += Number(expense.amount || 0);
      return accumulator;
    }, {})
  ), [expenses]);

  // Custom tooltip that uses formatMoney for currency-aware display
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-card-foreground mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.fill || entry.stroke }}>
            {entry.name}: <b>{formatMoney(entry.value)}</b>
          </p>
        ))}
      </div>
    );
  };

  const monthlyFinance = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(new Date(), 5 - index);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const monthSales = sales.filter((sale) => sale.sale_date && isWithinInterval(safeParse(sale.sale_date), interval));
    const monthDeals = deals.filter((deal) => deal.stage === 'closed_won' && isWithinInterval(safeParse(deal.updated_date || deal.created_date), interval));
    const monthExpenses = expenses.filter((expense) => expense.expense_date && isWithinInterval(safeParse(expense.expense_date), interval));
    const monthPurchases = purchaseOrders.filter((order) => order.order_date && isWithinInterval(safeParse(order.order_date), interval));
    const revenue = monthSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0) + monthDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const expenseValue = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const purchaseValue = monthPurchases.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    return {
      month: format(month, 'MMM'),
      Revenue: revenue,
      Expenses: expenseValue,
      Purchases: purchaseValue,
      Net: revenue - expenseValue - purchaseValue,
    };
  }), [sales, deals, expenses, purchaseOrders]);

  const recentExpenses = useMemo(() => expenses.slice(0, 12), [expenses]);

  const handleDeleteExpense = async (expense) => {
    const confirmed = await confirm({
      title: 'Delete expense?',
      description: `Delete ${expense.title} from accounting records.`,
      confirmLabel: 'Delete expense',
      destructive: true,
    });
    if (confirmed) {
      deleteExpenseMutation.mutate(expense.id);
    }
  };

  return (
    <div>
      <PageHeader
        title="Accounting"
        subtitle={`${profile.companyName || 'Your business'} financial picture across CRM, sales, purchases, and expenses`}
        actions={
          <Button onClick={() => { setEditingExpense(null); setExpenseDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Expense
          </Button>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: formatMoney(totalRevenue), sub: 'CRM won deals + sales' },
          { label: 'Expense Run Rate', value: formatMoney(totalExpenses), sub: `${expenses.length} expense records` },
          { label: 'Purchase Outflow', value: formatMoney(purchaseOutflow), sub: 'Paid supplier orders' },
          { label: 'Operating Result', value: formatMoney(operatingResult), sub: 'Revenue less expenses and purchases', highlight: operatingResult >= 0 ? 'text-accent' : 'text-destructive' },
          { label: 'Pending Expenses', value: formatMoney(pendingExpenses), sub: 'Unpaid or scheduled' },
          { label: 'Pending Purchases', value: formatMoney(pendingPurchases), sub: 'Outstanding supplier payments' },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
            <p className={cn('text-3xl font-bold', highlight || 'text-card-foreground')}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      {expenses.length === 0 && sales.length === 0 && deals.length === 0 && purchaseOrders.length === 0 ? (
        <EmptyState icon={Landmark} title="No accounting data yet" description="Revenue, expenses, and procurement analytics will appear once transactions are recorded." actionLabel="Add Expense" onAction={() => setExpenseDialogOpen(true)} />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Revenue vs Costs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Monthly movement across revenue, expenses, and purchases</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyFinance} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="financeRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS[1]} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={COLORS[1]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Revenue" stroke={COLORS[1]} fill="url(#financeRevenue)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Expenses" stroke={COLORS[3]} fillOpacity={0} strokeWidth={2} />
                  <Area type="monotone" dataKey="Purchases" stroke={COLORS[2]} fillOpacity={0} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Expense Category Mix</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Where the money is going</p>
              </div>
              {expenseByCategory.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">No expense records yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={expenseByCategory} dataKey="value" innerRadius={56} outerRadius={88} paddingAngle={3}>
                      {expenseByCategory.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Monthly Net Result</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Profitability after expenses and purchases</p>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyFinance} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Net" radius={[4, 4, 0, 0]}>
                    {monthlyFinance.map((entry) => (
                      <Cell key={entry.month} fill={entry.Net >= 0 ? COLORS[1] : COLORS[3]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="space-y-3">
                {[
                  { label: 'Sales Revenue', desc: 'Direct product and service sales recorded in inventory', value: salesRevenue, icon: Wallet, bg: 'bg-emerald-100', color: 'text-emerald-700' },
                  { label: 'CRM Revenue', desc: 'Closed-won deal value from the CRM pipeline', value: crmRevenue, icon: TrendingUp, bg: 'bg-blue-100', color: 'text-blue-700' },
                  { label: 'Operating Costs', desc: 'Expenses plus paid purchase orders', value: totalExpenses + purchaseOutflow, icon: TrendingDown, bg: 'bg-red-100', color: 'text-red-700' },
                ].map(({ label, desc, value, icon: Icon, bg, color }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', bg)}>
                      <Icon className={cn('w-5 h-5', color)} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                      <p className="text-xl font-bold text-card-foreground mt-1">{formatMoney(value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">Recent Expenses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Monitor payments, vendors, and expense categories</p>
            </div>
            {recentExpenses.length === 0 ? (
              <div className="p-8">
                <EmptyState icon={Receipt} title="No expenses yet" description="Track payroll, software, logistics, rent, and other operating costs here." actionLabel="Add Expense" onAction={() => setExpenseDialogOpen(true)} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Expense</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Category</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Amount</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map((expense) => (
                      <tr key={expense.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-card-foreground">{expense.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {expense.vendor_name || 'Internal'} | {expense.expense_date ? format(safeParse(expense.expense_date), 'MMM d, yyyy') : '-'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm text-card-foreground capitalize">
                          {(expense.category || '').replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-card-foreground">{formatMoney(expense.amount)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn(
                            "text-[10px] capitalize",
                            expense.payment_status === 'paid' ? 'bg-green-50 text-green-700 border-green-200' :
                            expense.payment_status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          )}>
                            {expense.payment_status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingExpense(expense); setExpenseDialogOpen(true); }}>
                                <CreditCard className="w-3.5 h-3.5 mr-2" />Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteExpense(expense)}>
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <ExpenseFormDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={editingExpense}
        onSave={(data) => expenseMutation.mutate({ id: editingExpense?.id, data })}
      />
    </div>
  );
}
