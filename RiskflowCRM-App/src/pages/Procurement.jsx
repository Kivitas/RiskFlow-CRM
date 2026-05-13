import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmClient } from '@/api/crmClient';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import SupplierFormDialog from '@/Components/procurement/SupplierFormDialog';
import PurchaseOrderFormDialog from '@/Components/procurement/PurchaseOrderFormDialog';
import { MoreHorizontal, Plus, ShoppingBag, Truck, Users } from 'lucide-react';
import { useBusiness } from '@/lib/BusinessContext';
import { useConfirm } from '@/lib/ConfirmContext';
import { useCurrency } from '@/lib/CurrencyContext';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const COLORS = ['hsl(230,65%,52%)', 'hsl(172,60%,42%)', 'hsl(38,92%,55%)', 'hsl(0,72%,55%)', 'hsl(280,55%,55%)'];

const safeParse = (dateStr) => {
  try { return parseISO(dateStr); } catch { return new Date(0); }
};

export default function Procurement() {
  const qc = useQueryClient();
  const { profile } = useBusiness();
  const { formatMoney } = useCurrency();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: () => crmClient.suppliers.list('-created_date') });
  const { data: purchaseOrders = [] } = useQuery({ queryKey: ['purchase-orders'], queryFn: () => crmClient.purchases.list('-order_date') });
  const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: () => crmClient.products.list('-created_date') });

  const supplierMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.suppliers.update(id, data) : crmClient.suppliers.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      setSupplierDialogOpen(false);
      setEditingSupplier(null);
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.purchases.update(id, data) : crmClient.purchases.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setOrderDialogOpen(false);
      setEditingOrder(null);
    },
    onError: (error) => toast({ title: 'Purchase order failed', description: error.message, variant: 'destructive' }),
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: (id) => crmClient.suppliers.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: (id) => crmClient.purchases.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });

  const filteredSuppliers = useMemo(
    () => suppliers.filter((s) =>
      `${s.name} ${s.contact_person || ''} ${s.email || ''}`.toLowerCase().includes(search.toLowerCase())
    ),
    [suppliers, search]
  );

  const receivedOrders = purchaseOrders.filter((o) => o.status === 'received');
  const orderedOrders = purchaseOrders.filter((o) => o.status === 'ordered');
  const totalPurchaseValue = purchaseOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const receivedUnits = receivedOrders.reduce((sum, o) => sum + Number(o.quantity || 0), 0);

  const supplierSpend = useMemo(() => Object.values(
    purchaseOrders.reduce((acc, order) => {
      acc[order.supplier_id] = acc[order.supplier_id] || { name: order.supplier_name, Spend: 0, Orders: 0 };
      acc[order.supplier_id].Spend += Number(order.total_amount || 0);
      acc[order.supplier_id].Orders += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.Spend - a.Spend).slice(0, 6), [purchaseOrders]);

  const monthlyPurchases = useMemo(() => Array.from({ length: 6 }, (_, index) => {
    const month = subMonths(new Date(), 5 - index);
    const interval = { start: startOfMonth(month), end: endOfMonth(month) };
    const orders = purchaseOrders.filter((o) => o.order_date && isWithinInterval(safeParse(o.order_date), interval));
    return {
      month: format(month, 'MMM'),
      Spend: orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
      Orders: orders.length,
    };
  }), [purchaseOrders]);

  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-card-foreground mb-1">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} style={{ color: entry.fill || entry.stroke }}>
            {entry.name}: <b>{entry.name.includes('Spend') ? formatMoney(entry.value) : entry.value}</b>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Procurement"
        subtitle={`${profile.companyName || 'Your business'} supplier operations | ${suppliers.length} suppliers | ${purchaseOrders.length} purchase orders`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setEditingSupplier(null); setSupplierDialogOpen(true); }}>
              <Users className="w-4 h-4 mr-2" />Add Supplier
            </Button>
            <Button
              onClick={() => { setEditingOrder(null); setOrderDialogOpen(true); }}
              disabled={suppliers.length === 0 || products.length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />New Purchase Order
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Suppliers</p>
          <p className="text-3xl font-bold text-card-foreground">{suppliers.length}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Active vendor relationships</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Purchase Spend</p>
          <p className="text-3xl font-bold text-card-foreground">{formatMoney(totalPurchaseValue)}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Across all purchase orders</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Received Units</p>
          <p className="text-3xl font-bold text-card-foreground">{receivedUnits}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Stock moved into inventory</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Open Orders</p>
          <p className="text-3xl font-bold text-card-foreground">{orderedOrders.length}</p>
          <p className="text-xs text-muted-foreground mt-1.5">Awaiting receipt</p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No suppliers yet"
          description="Add suppliers first, then place purchase orders to bring stock into inventory."
          actionLabel="Add Supplier"
          onAction={() => setSupplierDialogOpen(true)}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Monthly Procurement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Orders and spend over the last 6 months</p>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyPurchases} margin={{ top: 0, right: 5, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,90%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(220,10%,46%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Spend" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-card-foreground">Top Supplier Spend</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Largest supplier relationships by purchase value</p>
              </div>
              {supplierSpend.length === 0 ? (
                <div className="flex items-center justify-center h-[240px] text-sm text-muted-foreground">No purchase orders yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={supplierSpend} dataKey="Spend" innerRadius={56} outerRadius={86} paddingAngle={3}>
                      {supplierSpend.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-card-foreground">Suppliers</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Manage vendors, payment terms, and contacts</p>
                </div>
                <div className="md:w-72">
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search suppliers" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Supplier</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Terms</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-card-foreground">{supplier.name}</p>
                          <p className="text-xs text-muted-foreground">{supplier.contact_person || supplier.email || 'No contact details'}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-card-foreground">{supplier.payment_terms}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn(
                            "text-[10px] capitalize",
                            supplier.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                          )}>
                            {supplier.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setEditingSupplier(supplier); setSupplierDialogOpen(true); }}>Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={async () => {
                                const confirmed = await confirm({
                                  title: 'Delete supplier?',
                                  description: `Delete ${supplier.name} and all related purchase orders.`,
                                  confirmLabel: 'Delete supplier',
                                  destructive: true,
                                });
                                if (confirmed) deleteSupplierMutation.mutate(supplier.id);
                              }}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="p-5 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Recent Purchase Orders</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Track order status, supplier commitments, and received stock</p>
              </div>
              {purchaseOrders.length === 0 ? (
                <div className="p-8">
                  <EmptyState icon={ShoppingBag} title="No purchase orders yet" description="Create a purchase order once suppliers and products are available." actionLabel="New Purchase Order" onAction={() => setOrderDialogOpen(true)} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Order</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Qty</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Amount</th>
                        <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrders.slice(0, 10).map((order) => (
                        <tr key={order.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <p className="text-sm font-semibold text-card-foreground">{order.product_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {order.supplier_name} | {order.order_date ? format(safeParse(order.order_date), 'MMM d, yyyy') : '-'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-sm text-card-foreground">{order.quantity}</td>
                          <td className="px-4 py-3 text-sm text-card-foreground">{formatMoney(order.total_amount)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn(
                              "text-[10px] capitalize",
                              order.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' :
                              order.status === 'ordered' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              order.status === 'draft' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                              'bg-red-50 text-red-700 border-red-200'
                            )}>
                              {order.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingOrder(order); setOrderDialogOpen(true); }}>Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={async () => {
                                  const confirmed = await confirm({
                                    title: 'Delete purchase order?',
                                    description: 'If stock was already received, deleting this order will reverse that stock movement.',
                                    confirmLabel: 'Delete purchase order',
                                    destructive: true,
                                  });
                                  if (confirmed) deletePurchaseMutation.mutate(order.id);
                                }}>Delete</DropdownMenuItem>
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
          </div>
        </>
      )}

      <SupplierFormDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        supplier={editingSupplier}
        onSave={(data) => supplierMutation.mutate({ id: editingSupplier?.id, data })}
      />
      <PurchaseOrderFormDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        order={editingOrder}
        suppliers={suppliers}
        products={products}
        onSave={(data) => purchaseMutation.mutate({ id: editingOrder?.id, data })}
      />
    </div>
  );
}
