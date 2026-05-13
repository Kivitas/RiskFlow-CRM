import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRightLeft,
  CreditCard,
  FileText,
  Landmark,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Wallet,
} from 'lucide-react';
import { crmClient } from '@/api/crmClient';
import { generateQuotePdf, generateSalesOrderInvoicePdf } from '@/lib/invoices';
import { useConfirm } from '@/lib/ConfirmContext';
import { cn } from '@/lib/utils';
import { useBusiness } from '@/lib/BusinessContext';
import { useCurrency } from '@/lib/CurrencyContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import QuoteFormDialog from '@/Components/sales/QuoteFormDialog';
import OrderFormDialog from '@/Components/sales/OrderFormDialog';
import PaymentFormDialog from '@/Components/sales/PaymentFormDialog';
import { toast } from '@/components/ui/use-toast';

const tabs = ['Quotes', 'Orders', 'Payments'];

const statusBadge = (status) =>
  cn(
    'text-[10px] capitalize',
    ['accepted', 'approved', 'confirmed', 'completed', 'received', 'paid'].includes(status)
      ? 'bg-green-50 text-green-700 border-green-200'
      : ['pending', 'sent', 'invoiced', 'draft', 'partial', 'unpaid'].includes(status)
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : ['rejected', 'cancelled', 'expired'].includes(status)
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-slate-50 text-slate-600 border-slate-200'
  );

const safeFmt = (dateStr) => {
  try {
    return dateStr ? format(new Date(dateStr), 'MMM d, yyyy') : '-';
  } catch {
    return '-';
  }
};

export default function SalesHub() {
  const qc = useQueryClient();
  const { profile } = useBusiness();
  const { formatMoney, currencyInfo, convertAmount } = useCurrency();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState('Quotes');
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);

  const { data: contacts = [] } = useQuery({ queryKey: ['contacts'], queryFn: () => crmClient.entities.Contact.list() });
  const { data: quotes = [] } = useQuery({ queryKey: ['quotes'], queryFn: () => crmClient.quotes.list() });
  const { data: orders = [] } = useQuery({ queryKey: ['sales-orders'], queryFn: () => crmClient.salesOrders.list() });
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => crmClient.payments.list() });
  const orderPayments = useMemo(() => payments.filter((payment) => payment.reference_type !== 'sale'), [payments]);

  const quoteMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.quotes.update(id, data) : crmClient.quotes.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setQuoteDialogOpen(false);
      setEditingQuote(null);
    },
    onError: (error) => toast({ title: 'Quote save failed', description: error.message, variant: 'destructive' }),
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: (id) => crmClient.quotes.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
    onError: (error) => toast({ title: 'Quote deletion failed', description: error.message, variant: 'destructive' }),
  });

  const orderMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.salesOrders.update(id, data) : crmClient.salesOrders.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      setOrderDialogOpen(false);
      setEditingOrder(null);
    },
    onError: (error) => toast({ title: 'Order save failed', description: error.message, variant: 'destructive' }),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: (id) => crmClient.salesOrders.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (error) => toast({ title: 'Order deletion failed', description: error.message, variant: 'destructive' }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? crmClient.payments.update(id, data) : crmClient.payments.create(data)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
    },
    onError: (error) => toast({ title: 'Payment save failed', description: error.message, variant: 'destructive' }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id) => crmClient.payments.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
    },
    onError: (error) => toast({ title: 'Payment deletion failed', description: error.message, variant: 'destructive' }),
  });

  const convertQuoteMutation = useMutation({
    mutationFn: (id) => crmClient.quotes.convertToOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] });
      qc.invalidateQueries({ queryKey: ['sales-orders'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    },
    onError: (error) => toast({ title: 'Quote conversion failed', description: error.message, variant: 'destructive' }),
  });

  const quoteValue = useMemo(() => quotes.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), [quotes]);
  const orderValue = useMemo(() => orders.reduce((sum, item) => sum + Number(item.total_amount || 0), 0), [orders]);
  const receivedPayments = useMemo(() => orderPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0), [orderPayments]);
  const confirmedOrderValue = useMemo(
    () => orders.filter((order) => order.status !== 'cancelled').reduce((sum, item) => sum + Number(item.total_amount || 0), 0),
    [orders]
  );
  const outstanding = Math.max(0, confirmedOrderValue - receivedPayments);

  const openPaymentForOrder = (order) => {
    setEditingPayment({
      reference_type: 'sales_order',
      reference_id: order.id,
      customer_name: order.customer_name,
      amount: order.balance_due || order.total_amount,
      payment_date: new Date().toISOString().slice(0, 10),
      method: 'bank_transfer',
      status: 'received',
      notes: '',
    });
    setPaymentDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="Sales Operations"
        subtitle={`${profile.companyName || 'Your business'} quote-to-cash workspace with approvals, invoices, and payment tracking`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { setEditingQuote(null); setQuoteDialogOpen(true); }}>
              <FileText className="w-4 h-4 mr-2" />New Quote
            </Button>
            <Button variant="outline" onClick={() => { setEditingOrder(null); setOrderDialogOpen(true); }}>
              <Receipt className="w-4 h-4 mr-2" />New Order
            </Button>
            <Button onClick={() => { setEditingPayment(null); setPaymentDialogOpen(true); }}>
              <CreditCard className="w-4 h-4 mr-2" />Record Payment
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Quote Pipeline', value: formatMoney(quoteValue), sub: `${quotes.length} quotes created` },
          { label: 'Order Book', value: formatMoney(orderValue), sub: `${orders.length} orders recorded` },
          { label: 'Payments Received', value: formatMoney(receivedPayments), sub: `${orderPayments.length} payment entries` },
          { label: 'Outstanding', value: formatMoney(outstanding), sub: 'Active orders not yet collected', highlight: outstanding > 0 ? 'text-amber-600' : 'text-emerald-600' },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
            <p className={cn('text-3xl font-bold', highlight || 'text-card-foreground')}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              activeTab === tab ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {tab}
            {tab === 'Quotes' && quotes.length > 0 && <span className="ml-1.5 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{quotes.length}</span>}
            {tab === 'Orders' && orders.length > 0 && <span className="ml-1.5 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{orders.length}</span>}
            {tab === 'Payments' && orderPayments.length > 0 && <span className="ml-1.5 bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">{orderPayments.length}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'Quotes' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Quotes and Proposals</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Prepare offers, send for approval, and convert accepted quotes into sales orders</p>
            </div>
            <Button size="sm" onClick={() => { setEditingQuote(null); setQuoteDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />New Quote
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Quote', 'Customer', 'Date', 'Status', 'Approval', 'Amount', 'Actions'].map((heading) => (
                    <th key={heading} className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3', heading === 'Actions' ? 'text-right' : 'text-left')}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-card-foreground">{quote.document_number}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{quote.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-card-foreground">{quote.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{safeFmt(quote.quote_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadge(quote.status)}>{quote.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadge(quote.approval_status)}>{quote.approval_status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-card-foreground">{formatMoney(quote.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingQuote(quote); setQuoteDialogOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateQuotePdf({ profile, quote, currencyInfo, convertAmount })}>
                            <FileText className="w-3.5 h-3.5 mr-2" />PDF
                          </DropdownMenuItem>
                          {quote.status !== 'accepted' && (
                            <DropdownMenuItem
                              disabled={['pending', 'rejected'].includes(quote.approval_status)}
                              onClick={() => convertQuoteMutation.mutate(quote.id)}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />Convert to Order
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={async () => {
                            const confirmed = await confirm({
                              title: 'Delete quote?',
                              description: 'This will permanently remove the quote from the sales workflow.',
                              confirmLabel: 'Delete quote',
                              destructive: true,
                            });
                            if (confirmed) deleteQuoteMutation.mutate(quote.id);
                          }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {quotes.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-sm text-muted-foreground text-center">No quotes yet - create your first proposal.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Orders' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-card-foreground">Sales Orders</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Track confirmed business, invoice-ready orders, and completion status</p>
            </div>
            <Button size="sm" onClick={() => { setEditingOrder(null); setOrderDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />New Order
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Order', 'Customer', 'Date', 'Due Date', 'Status', 'Payment', 'Amount', 'Actions'].map((heading) => (
                    <th key={heading} className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3', heading === 'Actions' ? 'text-right' : 'text-left')}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-card-foreground">{order.document_number}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{order.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-card-foreground">{order.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{safeFmt(order.order_date)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{safeFmt(order.due_date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadge(order.status)}>{order.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadge(order.payment_status || 'unpaid')}>{order.payment_status || 'unpaid'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-card-foreground">{formatMoney(order.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditingOrder(order); setOrderDialogOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => generateSalesOrderInvoicePdf({ profile, order, currencyInfo, convertAmount })}>
                            <FileText className="w-3.5 h-3.5 mr-2" />Invoice PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openPaymentForOrder(order)}>
                            <CreditCard className="w-3.5 h-3.5 mr-2" />Record Payment
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={async () => {
                            const confirmed = await confirm({
                              title: 'Delete sales order?',
                              description: 'Deleting the order will also remove linked receivable tracking for it.',
                              confirmLabel: 'Delete order',
                              destructive: true,
                            });
                            if (confirmed) deleteOrderMutation.mutate(order.id);
                          }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-sm text-muted-foreground text-center">No sales orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-4">
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Payments and Receipts</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Match incoming payments against orders and keep receivables current</p>
              </div>
              <Button size="sm" onClick={() => { setEditingPayment(null); setPaymentDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-1" />Record Payment
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {['Receipt', 'Customer', 'Date', 'Method', 'Amount', 'Actions'].map((heading) => (
                      <th key={heading} className={cn('text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3', heading === 'Actions' ? 'text-right' : 'text-left')}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-card-foreground">{payment.document_number}</p>
                        {payment.notes && <p className="text-xs text-muted-foreground truncate max-w-[120px]">{payment.notes}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-card-foreground">{payment.customer_name || 'Manual'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{safeFmt(payment.payment_date)}</td>
                      <td className="px-4 py-3 text-sm capitalize text-card-foreground">{(payment.method || '').replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-card-foreground">{formatMoney(payment.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditingPayment(payment); setPaymentDialogOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={async () => {
                              const confirmed = await confirm({
                                title: 'Delete payment?',
                                description: 'This will recalculate the linked order balance immediately.',
                                confirmLabel: 'Delete payment',
                                destructive: true,
                              });
                              if (confirmed) deletePaymentMutation.mutate(payment.id);
                            }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" />Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {orderPayments.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-sm text-muted-foreground text-center">No payments recorded yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Receivables Snapshot</h3>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Total order value', value: formatMoney(orderValue) },
                  { label: 'Collected so far', value: formatMoney(receivedPayments), color: 'text-emerald-600' },
                  { label: 'Outstanding balance', value: formatMoney(outstanding), color: outstanding > 0 ? 'text-amber-600' : 'text-emerald-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={cn('font-semibold', color || 'text-card-foreground')}>{value}</span>
                  </div>
                ))}
                {orderValue > 0 && (
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Collection rate</span>
                      <span>{orderValue > 0 ? Math.round((receivedPayments / orderValue) * 100) : 0}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, orderValue > 0 ? (receivedPayments / orderValue) * 100 : 0)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-card-foreground">Workflow Coverage</h3>
              </div>
              <div className="space-y-2 text-xs text-muted-foreground">
                <p>Quotes can trigger approvals before conversion.</p>
                <p>Orders support invoice PDF generation.</p>
                <p>Payments can be tied to orders or recorded manually.</p>
                <p>Order payment status updates automatically from recorded receipts.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuoteFormDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        quote={editingQuote}
        contacts={contacts}
        defaultTaxRate={profile.taxRate}
        onSave={(data) => quoteMutation.mutate({ id: editingQuote?.id, data })}
      />
      <OrderFormDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        order={editingOrder}
        defaultTaxRate={profile.taxRate}
        onSave={(data) => orderMutation.mutate({ id: editingOrder?.id, data })}
      />
      <PaymentFormDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        payment={editingPayment}
        orders={orders}
        onSave={(data) => paymentMutation.mutate({ id: editingPayment?.id, data })}
      />
    </div>
  );
}
