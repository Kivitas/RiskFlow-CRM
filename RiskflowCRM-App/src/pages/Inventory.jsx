import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Barcode,
  Boxes,
  ChevronDown,
  ChevronUp,
  FileText,
  MoreHorizontal,
  Package,
  PackagePlus,
  Pencil,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Trash2,
  View,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProductFormDialog from '@/Components/inventory/ProductFormDialog';
import SaleFormDialog from '@/Components/inventory/SaleFormDialog';
import StockAdjustmentDialog from '@/Components/workspace/StockAdjustmentDialog';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { generateSaleInvoicePdf } from '@/lib/invoices';
import { buildInvoiceMessage, openEmailWorkflow, openWhatsAppWorkflow } from '@/lib/workflowLinks';
import { toast } from '@/components/ui/use-toast';

// ─── constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
];
const TABS = ['Overview', 'Products', 'Sales', 'Analytics', 'Barcode & AR'];

// ─── helpers ──────────────────────────────────────────────────────────────────
const pct = (num, denom) => denom ? `${((num / denom) * 100).toFixed(1)}%` : '-';

const safeParse = (dateStr) => {
  try { return parseISO(dateStr); } catch { return new Date(0); }
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent = '#6366f1', trend, trendUp }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.06] -translate-y-6 translate-x-6"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: accent }} />
        </div>
        {trend !== undefined && (
          <span className={cn(
            'text-[11px] font-semibold flex items-center gap-0.5 px-2 py-0.5 rounded-full',
            trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          )}>
            {trendUp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {trend}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800 tracking-tight mb-0.5">{value}</p>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// ─── Stock health bar ─────────────────────────────────────────────────────────
function StockBar({ qty, reorder, max }) {
  const ratio = max > 0 ? Math.min(qty / max, 1) : 0;
  const isLow = qty <= reorder;
  const isCritical = qty === 0;
  const color = isCritical ? '#ef4444' : isLow ? '#f59e0b' : '#10b981';
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${ratio * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    draft: 'bg-slate-100 text-slate-500 border-slate-200',
    discontinued: 'bg-red-50 text-red-600 border-red-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    refunded: 'bg-red-50 text-red-600 border-red-200',
  };
  return (
    <span className={cn(
      'text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border inline-block',
      map[status] || 'bg-slate-100 text-slate-500 border-slate-200'
    )}>
      {status}
    </span>
  );
}

// ─── Main Inventory Page ──────────────────────────────────────────────────────
export default function Inventory() {
  const qc = useQueryClient();
  const { profile } = useBusiness();
  const { formatMoney, currencyInfo, convertAmount } = useCurrency();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('Overview');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [draftSaleProductId, setDraftSaleProductId] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [saleSearch, setSaleSearch] = useState('');
  const [scanInput, setScanInput] = useState('');

  // Use formatMoney from context everywhere instead of local money()
  const money = formatMoney;

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => crmClient.products.list('-created_date'),
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouses'],
    queryFn: () => crmClient.warehouses.list('name'),
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['sales'],
    queryFn: () => crmClient.sales.list('-sale_date'),
  });

  const { data: stockAdjustments = [] } = useQuery({
    queryKey: ['stock-adjustments'],
    queryFn: () => crmClient.stockAdjustments.list('-adjustment_date', 8),
  });

  const completedSales = useMemo(
    () => sales.filter((sale) => sale.payment_status !== 'refunded'),
    [sales]
  );

  const refundedSales = useMemo(
    () => sales.filter((sale) => sale.payment_status === 'refunded'),
    [sales]
  );

  // ── mutations ──
  const productMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? crmClient.products.update(id, data) : crmClient.products.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      setProductDialogOpen(false);
      setEditingProduct(null);
    },
    onError: (e) => toast({ title: 'Product save failed', description: e.message, variant: 'destructive' }),
  });

  const saleMutation = useMutation({
    mutationFn: ({ id, data }) =>
      id ? crmClient.sales.update(id, data) : crmClient.sales.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
      setSaleDialogOpen(false);
      setEditingSale(null);
    },
    onError: (e) => toast({ title: 'Sale save failed', description: e.message, variant: 'destructive' }),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => crmClient.products.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  const deleteSaleMutation = useMutation({
    mutationFn: (id) => crmClient.sales.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['sales'] });
    },
  });

  const adjustmentMutation = useMutation({
    mutationFn: (data) => crmClient.stockAdjustments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['stock-adjustments'] });
      setAdjustmentDialogOpen(false);
    },
    onError: (e) => toast({ title: 'Stock adjustment failed', description: e.message, variant: 'destructive' }),
  });

  // ── computed stats ──
  const lowStockProducts = products.filter(
    (p) => p.status === 'active' && Number(p.stock_quantity || 0) <= Number(p.reorder_level || 0)
  );
  const outOfStock = products.filter(
    (p) => p.status === 'active' && Number(p.stock_quantity || 0) === 0
  );
  const inventoryValue = products.reduce((s, p) => s + Number(p.inventory_value || 0), 0);
  const totalRevenue = completedSales.reduce((s, sale) => s + Number(sale.total_amount || 0), 0);
  const refundedRevenue = refundedSales.reduce((s, sale) => s + Number(sale.total_amount || 0), 0);
  const totalUnitsSold = completedSales.reduce((s, sale) => s + Number(sale.quantity || 0), 0);
  const pendingPayments = sales
    .filter((s) => s.payment_status === 'pending')
    .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const grossProfit = completedSales.reduce((sum, sale) => {
    const product = products.find((p) => p.id === sale.product_id);
    if (!product) return sum;
    return sum + (Number(sale.unit_price || 0) - Number(product.cost_price || 0)) * Number(sale.quantity || 0);
  }, 0);

  const categories = useMemo(
    () => ['all', ...new Set(products.map((p) => p.category || 'general'))],
    [products]
  );

  // ── filtered + sorted products ──
  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      const matchSearch = `${p.name} ${p.sku} ${p.category} ${p.barcode || ''} ${p.ar_reference || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === 'all' || p.category === categoryFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchWarehouse = warehouseFilter === 'all' || p.warehouse_id === warehouseFilter;
      return matchSearch && matchCat && matchStatus && matchWarehouse;
    });
    list = [...list].sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      if (typeof av === 'number' && typeof bv === 'number')
        return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return list;
  }, [products, search, categoryFilter, statusFilter, warehouseFilter, sortField, sortDir]);

  const filteredSales = useMemo(
    () =>
      sales.filter((s) =>
        `${s.product_name} ${s.customer_name || ''}`.toLowerCase().includes(saleSearch.toLowerCase())
      ),
    [sales, saleSearch]
  );

  // ── chart data ──
  const categoryMix = useMemo(() => Object.values(
    products.reduce((acc, p) => {
      const k = p.category || 'general';
      acc[k] = acc[k] || { name: k, value: 0 };
      acc[k].value += 1;
      return acc;
    }, {})
  ), [products]);

  const stockLevels = useMemo(() => [...products]
    .sort((a, b) => Number(b.stock_quantity || 0) - Number(a.stock_quantity || 0))
    .slice(0, 8)
    .map((p) => ({
      name: p.name.length > 14 ? `${p.name.slice(0, 14)}...` : p.name,
      Stock: Number(p.stock_quantity || 0),
      Reorder: Number(p.reorder_level || 0),
    })), [products]);

  const topProducts = useMemo(() => Object.values(
    completedSales.reduce((acc, s) => {
      acc[s.product_id] = acc[s.product_id] || { name: s.product_name, Revenue: 0, Units: 0 };
      acc[s.product_id].Revenue += Number(s.total_amount || 0);
      acc[s.product_id].Units += Number(s.quantity || 0);
      return acc;
    }, {})
  )
    .sort((a, b) => b.Revenue - a.Revenue)
    .slice(0, 6)
    .map((p) => ({ ...p, name: p.name.length > 16 ? `${p.name.slice(0, 16)}...` : p.name })),
    [completedSales]);

  // Bug fix: use safeParse instead of new Date() to avoid crashes on bad date strings
  const monthlySales = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const month = subMonths(new Date(), 5 - i);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const ms = completedSales.filter((s) => s.sale_date && isWithinInterval(safeParse(s.sale_date), interval));
    return {
      month: format(month, 'MMM'),
      Revenue: ms.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
      Orders: ms.length,
    };
  }), [completedSales]);

  const warehouseSummary = useMemo(
    () =>
      warehouses
        .map((warehouse) => {
          const warehouseProducts = products.filter((product) => product.warehouse_id === warehouse.id);
          const warehouseValue = warehouseProducts.reduce(
            (sum, product) => sum + Number(product.inventory_value || 0),
            0
          );
          const lowStockCount = warehouseProducts.filter(
            (product) =>
              product.status === 'active' &&
              Number(product.stock_quantity || 0) <= Number(product.reorder_level || 0)
          ).length;
          return {
            id: warehouse.id,
            name: warehouse.name,
            productCount: warehouseProducts.length,
            inventoryValue: warehouseValue,
            lowStockCount,
          };
        })
        .sort((left, right) => right.inventoryValue - left.inventoryValue),
    [products, warehouses]
  );

  const toggleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }) =>
    sortField === field
      ? sortDir === 'asc'
        ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
        : <ChevronDown className="w-3 h-3 inline ml-0.5" />
      : null;

  const maxStock = Math.max(...products.map((p) => Number(p.stock_quantity || 0)), 1);

  const handleBarcodeLookup = () => {
    const code = scanInput.trim().toLowerCase();
    if (!code) return;
    const product = products.find((item) =>
      [item.barcode, item.sku, item.ar_reference].some((value) => String(value || '').toLowerCase() === code)
    );
    if (!product) {
      toast({ title: 'No product found', description: 'No product matches that barcode, SKU, or AR reference.', variant: 'destructive' });
      return;
    }
    setSearch(product.barcode || product.sku || product.name);
    setActiveTab('Products');
    toast({ title: 'Product found', description: `${product.name} is now filtered in the product list.` });
  };

  // Currency-aware tooltip for charts
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xl text-xs min-w-[130px]">
        <p className="font-semibold text-slate-700 mb-2 text-[11px] uppercase tracking-wide">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-3 mb-0.5">
            <span style={{ color: entry.fill || entry.stroke }} className="font-medium">{entry.name}</span>
            <b className="text-slate-800">
              {entry.name.toLowerCase().includes('revenue') || entry.name.toLowerCase().includes('value')
                ? money(entry.value)
                : entry.value}
            </b>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      {/* ── Header ── */}
      <PageHeader
        title="Inventory & Sales"
        subtitle={`${profile.companyName || 'Your business'} | ${products.length} products | ${warehouses.length} warehouses | ${sales.length} transactions`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => { setEditingSale(null); setDraftSaleProductId(''); setSaleDialogOpen(true); }}
              disabled={products.length === 0}
            >
              <ShoppingCart className="w-4 h-4 mr-2 text-indigo-500" />
              Record Sale
            </Button>
            <Button
              variant="outline"
              className="border-slate-200 text-slate-600 hover:bg-slate-50"
              onClick={() => setAdjustmentDialogOpen(true)}
              disabled={products.length === 0}
            >
              <RefreshCw className="w-4 h-4 mr-2 text-amber-500" />
              Adjust Stock
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              onClick={() => { setEditingProduct(null); setProductDialogOpen(true); }}
            >
              <PackagePlus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
        }
      />

      {/* ── KPI Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3 mb-5">
        <KpiCard label="Total Products" value={products.length} sub={`${outOfStock.length} out of stock`} icon={Boxes} accent="#6366f1" />
        <KpiCard label="Low Stock" value={lowStockProducts.length} sub="Need reordering" icon={AlertTriangle} accent="#f59e0b" />
        <KpiCard label="Inventory Value" value={money(inventoryValue)} sub="At cost price" icon={Package} accent="#06b6d4" />
        <KpiCard label="Sales Revenue" value={money(totalRevenue)} sub={`${totalUnitsSold} units sold`} icon={TrendingUp} accent="#10b981" />
        <KpiCard label="Refunded Sales" value={money(refundedRevenue)} sub={`${refundedSales.length} refunded transactions`} icon={ArrowDownCircle} accent="#ef4444" />
        <KpiCard label="Gross Profit" value={money(grossProfit)} sub={pct(grossProfit, totalRevenue) + ' margin'} icon={ArrowUpCircle} accent="#8b5cf6" />
        <KpiCard label="Pending Payments" value={money(pendingPayments)} sub="Awaiting collection" icon={RefreshCw} accent="#f59e0b" />
      </div>

      {/* ── Low stock alert banner ── */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {lowStockProducts.length} product{lowStockProducts.length > 1 ? 's' : ''} need restocking
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {lowStockProducts.slice(0, 4).map((p) => p.name).join(', ')}
              {lowStockProducts.length > 4 ? ` +${lowStockProducts.length - 4} more` : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 mb-5 w-fit shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TAB: OVERVIEW */}
      {activeTab === 'Overview' && (
        <>
          {products.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No inventory yet"
              description="Add products to start tracking stock, sales, and revenue."
              actionLabel="Add Product"
              onAction={() => setProductDialogOpen(true)}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Sales Trend</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Revenue and orders over the last 6 months</p>
                    </div>
                    <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg">
                      {money(totalRevenue)} total
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={monthlySales} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ordersGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="Revenue" stroke="#6366f1" fill="url(#revenueGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                      <Area type="monotone" dataKey="Orders" stroke="#10b981" fill="url(#ordersGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Category Mix</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Products by category</p>
                  </div>
                  {categoryMix.length === 0 ? (
                    <div className="flex items-center justify-center h-[200px] text-sm text-slate-400">No categories</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={categoryMix} dataKey="value" innerRadius={44} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                            {categoryMix.map((entry, i) => (
                              <Cell key={entry.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {categoryMix.map((entry, i) => (
                          <div key={entry.name} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
                            <span className="text-xs text-slate-500 capitalize flex-1">{entry.name}</span>
                            <span className="text-xs font-bold text-slate-700">{entry.value}</span>
                            <span className="text-[10px] text-slate-400">{pct(entry.value, products.length)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Stock Levels</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Current quantity by product</p>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={stockLevels} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Stock" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={36} />
                      <Bar dataKey="Reorder" fill="#fbbf24" radius={[5, 5, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Top Products by Revenue</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Best-performing items</p>
                  </div>
                  {topProducts.length === 0 ? (
                    <div className="flex items-center justify-center h-[200px] text-sm text-slate-400">No sales yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 8, left: 16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="Revenue" fill="#10b981" radius={[0, 5, 5, 0]} maxBarSize={22} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Stock Health at a Glance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[...products].sort((left, right) => {
                    const leftScore = Number(left.stock_quantity || 0) - Number(left.reorder_level || 0);
                    const rightScore = Number(right.stock_quantity || 0) - Number(right.reorder_level || 0);
                    return leftScore - rightScore;
                  }).slice(0, 6).map((p) => {
                    const qty = Number(p.stock_quantity || 0);
                    const reorder = Number(p.reorder_level || 0);
                    const isLow = qty <= reorder;
                    return (
                      <div key={p.id} className="border border-slate-100 rounded-xl p-3 hover:border-indigo-200 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-700 truncate max-w-[140px]">{p.name}</p>
                            <p className="text-[10px] text-slate-400">{p.sku}</p>
                          </div>
                          <span className={cn(
                            'text-xs font-bold',
                            qty === 0 ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-600'
                          )}>
                            {qty} units
                          </span>
                        </div>
                        <StockBar qty={qty} reorder={reorder} max={maxStock} />
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">Reorder at {reorder}</span>
                          {isLow && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                              Restock
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Recent Stock Adjustments</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Manual corrections, returns, and restocks</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-200 text-slate-600 hover:bg-slate-50"
                      onClick={() => setAdjustmentDialogOpen(true)}
                      disabled={products.length === 0}
                    >
                      New Adjustment
                    </Button>
                  </div>
                  {stockAdjustments.length === 0 ? (
                    <div className="flex items-center justify-center h-[180px] text-sm text-slate-400">No stock adjustments recorded</div>
                  ) : (
                    <div className="space-y-3">
                      {stockAdjustments.slice(0, 6).map((adjustment) => {
                        const quantity = Number(adjustment.quantity || 0);
                        const isIncrease = quantity > 0;
                        return (
                          <div key={adjustment.id} className="flex items-start justify-between gap-3 border border-slate-100 rounded-xl p-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{adjustment.product_name}</p>
                              <p className="text-xs text-slate-500 capitalize">
                                {(adjustment.reason || 'count_correction').replace(/_/g, ' ')} | {adjustment.warehouse_name || 'Default warehouse'}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1">{format(safeParse(adjustment.adjustment_date), 'dd MMM yyyy')}</p>
                            </div>
                            <div className="text-right">
                              <p className={cn('text-sm font-bold', isIncrease ? 'text-emerald-600' : 'text-red-500')}>
                                {isIncrease ? '+' : ''}{quantity}
                              </p>
                              {adjustment.notes ? (
                                <p className="text-[11px] text-slate-400 max-w-[160px] truncate">{adjustment.notes}</p>
                              ) : (
                                <p className="text-[11px] text-slate-300">No notes</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Warehouse Snapshot</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Inventory coverage and risk by location</p>
                  </div>
                  {warehouseSummary.length === 0 ? (
                    <div className="flex items-center justify-center h-[180px] text-sm text-slate-400">No warehouses configured</div>
                  ) : (
                    <div className="space-y-3">
                      {warehouseSummary.map((warehouse) => (
                        <div key={warehouse.id} className="border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{warehouse.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {warehouse.productCount} product{warehouse.productCount !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-slate-800">{money(warehouse.inventoryValue)}</p>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">Low stock items</span>
                            <span className={cn(
                              'font-semibold',
                              warehouse.lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                            )}>
                              {warehouse.lowStockCount}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* TAB: PRODUCTS */}
      {activeTab === 'Products' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU, barcode, AR reference, or category..."
                  className="pl-9 bg-slate-50 border-slate-200"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="discontinued">Discontinued</option>
                </select>
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="all">All Warehouses</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Showing {filteredProducts.length} of {products.length} products across {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''}
            </p>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No products found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {[
                      { label: 'Product', field: 'name' },
                      { label: 'SKU', field: 'sku' },
                      { label: 'Barcode / AR', field: 'barcode' },
                      { label: 'Category', field: 'category' },
                      { label: 'Warehouse', field: 'warehouse_name' },
                      { label: 'Stock', field: 'stock_quantity' },
                      { label: 'Unit Price', field: 'unit_price' },
                      { label: 'Cost Price', field: 'cost_price' },
                      { label: 'Value', field: 'inventory_value' },
                      { label: 'Status', field: 'status' },
                      { label: '', field: null },
                    ].map(({ label, field }) => (
                      <th
                        key={label}
                        onClick={field ? () => toggleSort(field) : undefined}
                        className={cn(
                          'text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap',
                          field && 'cursor-pointer hover:text-slate-600 select-none'
                        )}
                      >
                        {label}
                        {field && <SortIcon field={field} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredProducts.map((p) => {
                    const qty = Number(p.stock_quantity || 0);
                    const reorder = Number(p.reorder_level || 0);
                    const isLow = qty <= reorder;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                              <Package className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{p.name}</p>
                              {p.description && (
                                <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{p.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{p.sku}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                              <Barcode className="h-3 w-3" />
                              {p.barcode || p.sku}
                            </span>
                            {p.ar_reference ? <p className="text-[10px] text-slate-400">AR: {p.ar_reference}</p> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs capitalize text-slate-500">{p.category || 'general'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs text-slate-500">{p.warehouse_name || 'Default warehouse'}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1 min-w-[80px]">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                'text-sm font-bold',
                                qty === 0 ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-700'
                              )}>
                                {qty}
                              </span>
                              {isLow && qty > 0 && (
                                <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                                  Low
                                </span>
                              )}
                              {qty === 0 && (
                                <span className="text-[9px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-100">
                                  Out
                                </span>
                              )}
                            </div>
                            <StockBar qty={qty} reorder={reorder} max={maxStock} />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{money(p.unit_price)}</td>
                        <td className="px-4 py-3.5 text-sm text-slate-500">{money(p.cost_price)}</td>
                        <td className="px-4 py-3.5 text-sm font-semibold text-indigo-600">{money(p.inventory_value)}</td>
                        <td className="px-4 py-3.5">
                          <StatusPill status={p.status} />
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5 mr-2 text-slate-400" />Edit Product
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditingSale(null); setDraftSaleProductId(p.id); setSaleDialogOpen(true); }}>
                                <ShoppingCart className="w-3.5 h-3.5 mr-2 text-slate-400" />Record Sale
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setScanInput(p.barcode || p.sku || ''); setActiveTab('Barcode & AR'); }}>
                                <Barcode className="w-3.5 h-3.5 mr-2 text-slate-400" />Open Barcode Card
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={async () => {
                                  const confirmed = await confirm({
                                    title: 'Delete product?',
                                    description: `Delete ${p.name} and all related sales records.`,
                                    confirmLabel: 'Delete product',
                                    destructive: true,
                                  });
                                  if (confirmed) deleteProductMutation.mutate(p.id);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filteredProducts.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Total inventory value: <b className="text-slate-700">{money(filteredProducts.reduce((s, p) => s + Number(p.inventory_value || 0), 0))}</b></span>
              <span>Avg unit price: <b className="text-slate-700">{money(filteredProducts.reduce((s, p) => s + Number(p.unit_price || 0), 0) / (filteredProducts.length || 1))}</b></span>
              <span>Total units: <b className="text-slate-700">{filteredProducts.reduce((s, p) => s + Number(p.stock_quantity || 0), 0)}</b></span>
            </div>
          )}
        </div>
      )}

      {/* TAB: SALES */}
      {activeTab === 'Sales' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
                placeholder="Search by product or customer..."
                className="pl-9 bg-slate-50 border-slate-200"
              />
            </div>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              onClick={() => { setEditingSale(null); setDraftSaleProductId(''); setSaleDialogOpen(true); }}
              disabled={products.length === 0}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />New Sale
            </Button>
          </div>

          {filteredSales.length === 0 ? (
            <div className="p-12 text-center">
              <ReceiptText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">No sales recorded</p>
              <p className="text-xs text-slate-400 mt-1">Add products first, then record sales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Product', 'Customer', 'Date', 'Qty', 'Unit Price', 'Total', 'Channel', 'Payment', ''].map((h) => (
                      <th key={h} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                            <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <p className="text-sm font-semibold text-slate-700 whitespace-nowrap">{sale.product_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-slate-600">{sale.customer_name || <span className="text-slate-400 italic">Walk-in</span>}</p>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-500 whitespace-nowrap">
                        {sale.sale_date ? format(safeParse(sale.sale_date), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-slate-700">{sale.quantity}</td>
                      <td className="px-4 py-3.5 text-sm text-slate-500">{money(sale.unit_price)}</td>
                      <td className="px-4 py-3.5 text-sm font-bold text-slate-800">{money(sale.total_amount)}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs capitalize text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{sale.channel || 'direct'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={sale.payment_status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => { setEditingSale(sale); setSaleDialogOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5 mr-2 text-slate-400" />Edit Sale
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => generateSaleInvoicePdf({ profile, sale, currencyInfo, convertAmount })}>
                              <FileText className="w-3.5 h-3.5 mr-2 text-slate-400" />Download Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEmailWorkflow({
                              to: sale.customer_email || '',
                              subject: `Invoice from ${profile.companyName || 'RiskFlow CRM'}`,
                              body: buildInvoiceMessage({ profile, sale, total: money(sale.total_amount) }),
                            })}>
                              <FileText className="w-3.5 h-3.5 mr-2 text-slate-400" />Email Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openWhatsAppWorkflow({
                              phone: sale.customer_phone || '',
                              message: buildInvoiceMessage({ profile, sale, total: money(sale.total_amount) }),
                            })}>
                              <FileText className="w-3.5 h-3.5 mr-2 text-slate-400" />WhatsApp Invoice
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-500 focus:text-red-500"
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: 'Delete sale?',
                                  description: 'This will remove the sale and restore the stock quantity.',
                                  confirmLabel: 'Delete sale',
                                  destructive: true,
                                });
                                if (confirmed) deleteSaleMutation.mutate(sale.id);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
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

          {filteredSales.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Booked sales: <b className="text-slate-700">{money(filteredSales.filter((x) => x.payment_status !== 'refunded').reduce((s, x) => s + Number(x.total_amount || 0), 0))}</b></span>
              <span>Total units sold: <b className="text-slate-700">{filteredSales.filter((x) => x.payment_status !== 'refunded').reduce((s, x) => s + Number(x.quantity || 0), 0)}</b></span>
              <span>Refunded: <b className="text-red-600">{money(filteredSales.filter((x) => x.payment_status === 'refunded').reduce((s, x) => s + Number(x.total_amount || 0), 0))}</b></span>
              <span>Pending: <b className="text-amber-600">{money(filteredSales.filter((x) => x.payment_status === 'pending').reduce((s, x) => s + Number(x.total_amount || 0), 0))}</b></span>
            </div>
          )}
        </div>
      )}

      {/* TAB: ANALYTICS */}
      {activeTab === 'Analytics' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {['paid', 'pending', 'refunded'].map((status) => {
              const statusSales = sales.filter((s) => s.payment_status === status);
              const total = statusSales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
              const colors = { paid: '#10b981', pending: '#f59e0b', refunded: '#ef4444' };
              const icons = { paid: ArrowUpCircle, pending: RefreshCw, refunded: ArrowDownCircle };
              const Icon = icons[status];
              return (
                <div key={status} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4" style={{ color: colors[status] }} />
                    <span className="text-sm font-semibold text-slate-600 capitalize">{status}</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800 mb-1">{money(total)}</p>
                  <p className="text-xs text-slate-400">{statusSales.length} transaction{statusSales.length !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Revenue by Channel</h3>
              {(() => {
                const channelData = Object.values(
                  completedSales.reduce((acc, s) => {
                    const ch = s.channel || 'direct';
                    acc[ch] = acc[ch] || { name: ch, Revenue: 0, Orders: 0 };
                    acc[ch].Revenue += Number(s.total_amount || 0);
                    acc[ch].Orders += 1;
                    return acc;
                  }, {})
                );
                return channelData.length === 0 ? (
                  <div className="flex items-center justify-center h-[160px] text-sm text-slate-400">No sales data</div>
                ) : (
                  <div className="space-y-3">
                    {channelData.sort((a, b) => b.Revenue - a.Revenue).map((ch, i) => (
                      <div key={ch.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm capitalize text-slate-600 font-medium">{ch.name}</span>
                          <span className="text-sm font-bold text-slate-800">{money(ch.Revenue)}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: pct(ch.Revenue, totalRevenue),
                              backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">{ch.Orders} orders | {pct(ch.Revenue, totalRevenue)} of total</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Profit Margin by Product</h3>
              <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                {products
                  .map((p) => {
                    const productSales = completedSales.filter((s) => s.product_id === p.id);
                    const revenue = productSales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
                    const cost = productSales.reduce((s, x) => s + Number(x.quantity || 0) * Number(p.cost_price || 0), 0);
                    const profit = revenue - cost;
                    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                    return { ...p, revenue, profit, margin };
                  })
                  .filter((p) => p.revenue > 0)
                  .sort((a, b) => b.margin - a.margin)
                  .map((p) => (
                    <div key={p.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600 truncate max-w-[140px]">{p.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs font-bold',
                            p.margin >= 30 ? 'text-emerald-600' : p.margin >= 10 ? 'text-amber-600' : 'text-red-500'
                          )}>
                            {p.margin.toFixed(1)}%
                          </span>
                          <span className="text-xs text-slate-400">{money(p.profit)}</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(Math.max(p.margin, 0), 100)}%`,
                            backgroundColor: p.margin >= 30 ? '#10b981' : p.margin >= 10 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                {products.filter((p) => completedSales.some((s) => s.product_id === p.id)).length === 0 && (
                  <div className="flex items-center justify-center h-[160px] text-sm text-slate-400">No sales recorded yet</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Monthly Performance</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Month', 'Orders', 'Revenue', 'Avg Order Value', 'Units Sold'].map((h) => (
                      <th key={h} className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-2 pr-6">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {monthlySales.map((row) => {
                    // Bug fix: filter sales for month by month name comparison safely
                    const monthSales = completedSales.filter((s) => s.sale_date && format(safeParse(s.sale_date), 'MMM') === row.month);
                    const units = monthSales.reduce((s, x) => s + Number(x.quantity || 0), 0);
                    return (
                      <tr key={row.month} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-6 font-semibold text-slate-700">{row.month}</td>
                        <td className="py-3 pr-6 text-slate-600">{row.Orders}</td>
                        <td className="py-3 pr-6 font-bold text-slate-800">{money(row.Revenue)}</td>
                        <td className="py-3 pr-6 text-slate-600">{row.Orders > 0 ? money(row.Revenue / row.Orders) : '-'}</td>
                        <td className="py-3 pr-6 text-slate-600">{units}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Dialogs ── */}
      {activeTab === 'Barcode & AR' && (
        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50">
                <Barcode className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Barcode Lookup</h3>
                <p className="text-xs text-slate-500">Type or paste a scanner value, SKU, or AR reference.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <Input
                value={scanInput}
                onChange={(event) => setScanInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleBarcodeLookup();
                }}
                placeholder="Scan barcode or enter SKU"
                className="bg-slate-50"
              />
              <Button onClick={handleBarcodeLookup}>Find</Button>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Hardware barcode scanners work now because they type into this focused field and press Enter. Camera scanning and WebXR AR previews need HTTPS/device permissions and can be connected when this moves from local desktop mode to hosted deployment.
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50">
                <View className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">AR-ready Inventory Metadata</h3>
                <p className="text-xs text-slate-500">Attach AR references now; connect 3D viewers later.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {products.slice(0, 8).map((product) => (
                <div key={product.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-800">{product.name}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">{product.barcode || product.sku}</p>
                  <p className="mt-2 text-xs text-slate-500">AR ref: {product.ar_reference || 'Not added'}</p>
                </div>
              ))}
              {products.length === 0 ? <p className="text-sm text-slate-500">Add products to manage barcode and AR references.</p> : null}
            </div>
          </div>
        </div>
      )}

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        product={editingProduct}
        warehouses={warehouses}
        onSave={(data) => productMutation.mutate({ id: editingProduct?.id, data })}
      />
      <SaleFormDialog
        open={saleDialogOpen}
        onOpenChange={setSaleDialogOpen}
        sale={editingSale}
        products={products}
        initialProductId={draftSaleProductId}
        onSave={(data) => saleMutation.mutate({ id: editingSale?.id, data })}
      />
      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        products={products}
        onSave={(data) => adjustmentMutation.mutate(data)}
      />
    </div>
  );
}
