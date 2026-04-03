import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Filter, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { formatETB } from '@/lib/currency';

const PAYMENT_METHODS = ['Cash', 'Telebirr', 'CBE Birr', 'Ebirr Kaafi', 'Ebirr Coopay'];
const STATUSES = ['paid', 'pending'] as const;

const statusColors: Record<string, string> = {
  paid: 'bg-success/15 text-success border-success/30',
  pending: 'bg-warning/15 text-warning border-warning/30',
};

interface TransactionForm {
  customer_name: string;
  customer_phone: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  payment_method: string;
  notes: string;
  status: string;
}

const emptyForm: TransactionForm = {
  customer_name: '', customer_phone: '', service_id: '', quantity: 1,
  unit_price: 0, payment_method: 'Cash', notes: '', status: 'pending',
};

const Transactions = () => {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('is_active', true).order('service_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, services(service_name, category, affects_inventory)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (f: TransactionForm) => {
      const service = services.find(s => s.id === f.service_id);

      // Create or find customer
      let customerId: string | null = null;
      if (f.customer_name.trim()) {
        const { data: existing } = await supabase.from('customers')
          .select('id').eq('full_name', f.customer_name.trim()).limit(1).maybeSingle();
        if (existing) {
          customerId = existing.id;
        } else {
          const { data: newCust, error: custErr } = await supabase.from('customers')
            .insert({ full_name: f.customer_name.trim(), phone: f.customer_phone.trim() || null })
            .select('id').single();
          if (custErr) throw custErr;
          customerId = newCust.id;
        }
      }

      const { error } = await supabase.from('transactions').insert({
        customer_name: f.customer_name.trim(),
        customer_phone: f.customer_phone.trim() || null,
        service_id: f.service_id || null,
        card_type: service?.service_name || 'Other',
        quantity: f.quantity,
        unit_price: f.unit_price,
        payment_method: f.payment_method,
        notes: f.notes.trim() || null,
        status: f.status,
        created_by: user!.id,
        customer_id: customerId,
      });
      if (error) throw error;

      // Deduct inventory if service affects it
      if (service?.affects_inventory) {
        const { data: invItems } = await supabase.from('inventory_items')
          .select('id, quantity').limit(1);
        if (invItems && invItems.length > 0) {
          const item = invItems[0];
          await supabase.from('inventory_items').update({
            quantity: Math.max(0, item.quantity - f.quantity),
          }).eq('id', item.id);
        }
      }

      // Log audit
      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        action: 'create',
        entity: 'transaction',
        details: `Created transaction for ${f.customer_name} - ${service?.service_name || 'N/A'}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Transaction created');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: TransactionForm }) => {
      const service = services.find(s => s.id === f.service_id);
      const { error } = await supabase.from('transactions').update({
        customer_name: f.customer_name.trim(),
        customer_phone: f.customer_phone.trim() || null,
        service_id: f.service_id || null,
        card_type: service?.service_name || 'Other',
        quantity: f.quantity,
        unit_price: f.unit_price,
        payment_method: f.payment_method,
        notes: f.notes.trim() || null,
        status: f.status,
      }).eq('id', id);
      if (error) throw error;

      await supabase.from('audit_logs').insert({
        user_id: user!.id,
        action: 'update',
        entity: 'transaction',
        entity_id: id,
        details: `Updated transaction for ${f.customer_name}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction updated');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
      await supabase.from('audit_logs').insert({
        user_id: user!.id, action: 'delete', entity: 'transaction', entity_id: id,
        details: 'Deleted transaction',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(false); };

  const handleEdit = (tx: any) => {
    setForm({
      customer_name: tx.customer_name,
      customer_phone: tx.customer_phone || '',
      service_id: tx.service_id || '',
      quantity: tx.quantity,
      unit_price: Number(tx.unit_price),
      payment_method: tx.payment_method || 'Cash',
      notes: tx.notes || '',
      status: tx.status,
    });
    setEditingId(tx.id);
    setDialogOpen(true);
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setForm(f => ({
      ...f,
      service_id: serviceId,
      unit_price: service ? Number(service.default_price) : f.unit_price,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { toast.error('Customer name is required'); return; }
    if (!form.service_id) { toast.error('Please select a service'); return; }
    if (form.unit_price <= 0) { toast.error('Unit price must be greater than 0'); return; }
    if (editingId) updateMutation.mutate({ id: editingId, f: form });
    else createMutation.mutate(form);
  };

  const filtered = transactions.filter((tx: any) => {
    const matchSearch = !search ||
      tx.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (tx.services?.service_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (tx.customer_phone && tx.customer_phone.includes(search));
    const matchStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = filtered.reduce((sum: number, tx: any) => sum + Number(tx.total_price), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground">Record service transactions and payments</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" /> New Transaction</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit Transaction' : 'New Transaction'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name *</Label>
                  <Input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Full name" required />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Phone number" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Service *</Label>
                <Select value={form.service_id} onValueChange={handleServiceChange}>
                  <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
                  <SelectContent>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.service_name} — {formatETB(Number(s.default_price))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity *</Label>
                  <Input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price (ETB) *</Label>
                  <Input type="number" min={0} step={0.01} value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="p-3 rounded-md bg-muted text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold text-foreground">{formatETB(form.quantity * form.unit_price)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} />
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" className="gradient-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, service..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
          <span>{filtered.length} transactions</span>
          <span>•</span>
          <span className="font-semibold text-foreground">{formatETB(totalRevenue)} total</span>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Receipt className="h-8 w-8 mb-2" />
              <p className="text-sm">No transactions found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="hidden sm:table-cell">Service</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="hidden md:table-cell">Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tx: any) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{tx.customer_name}</p>
                          {tx.customer_phone && <p className="text-xs text-muted-foreground">{tx.customer_phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {tx.services?.service_name || tx.card_type || '—'}
                      </TableCell>
                      <TableCell className="text-right">{tx.quantity}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{formatETB(Number(tx.unit_price))}</TableCell>
                      <TableCell className="text-right font-medium">{formatETB(Number(tx.total_price))}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{tx.payment_method || 'Cash'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${statusColors[tx.status] || ''}`}>
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                        {format(new Date(tx.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(tx)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                              if (confirm('Delete this transaction?')) deleteMutation.mutate(tx.id);
                            }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Transactions;
