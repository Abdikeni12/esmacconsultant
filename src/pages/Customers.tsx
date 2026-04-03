import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, Users, Eye, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { formatETB } from '@/lib/currency';

interface CustomerForm {
  full_name: string;
  phone: string;
  notes: string;
}

const emptyForm: CustomerForm = { full_name: '', phone: '', notes: '' };

const Customers = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [viewingCustomer, setViewingCustomer] = useState<any>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: customerTransactions = [] } = useQuery({
    queryKey: ['customer-transactions', viewingCustomer?.id],
    enabled: !!viewingCustomer,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions')
        .select('*, services(service_name)')
        .eq('customer_id', viewingCustomer.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (f: CustomerForm) => {
      const { error } = await supabase.from('customers').insert({
        full_name: f.full_name.trim(),
        phone: f.phone.trim() || null,
        notes: f.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer added'); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: CustomerForm }) => {
      const { error } = await supabase.from('customers').update({
        full_name: f.full_name.trim(),
        phone: f.phone.trim() || null,
        notes: f.notes.trim() || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer updated'); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(false); };

  const handleEdit = (c: any) => {
    setForm({ full_name: c.full_name, phone: c.phone || '', notes: c.notes || '' });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Full name is required'); return; }
    if (editingId) updateMutation.mutate({ id: editingId, f: form });
    else createMutation.mutate(form);
  };

  const filtered = customers.filter((c: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.full_name.toLowerCase().includes(q) || (c.phone && c.phone.includes(search));
  });

  // Customer profile view
  if (viewingCustomer) {
    const totalSpent = customerTransactions.reduce((s: number, t: any) => s + Number(t.total_price), 0);
    const servicesUsed = [...new Set(customerTransactions.map((t: any) => t.services?.service_name || t.card_type).filter(Boolean))];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewingCustomer(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">{viewingCustomer.full_name}</h1>
            <p className="text-sm text-muted-foreground">{viewingCustomer.phone || 'No phone'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Spending</p>
              <p className="text-xl font-bold font-heading text-foreground">{formatETB(totalSpent)}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="text-xl font-bold font-heading text-foreground">{customerTransactions.length}</p>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Services Used</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {servicesUsed.length > 0 ? servicesUsed.map((s: string) => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                )) : <span className="text-sm text-muted-foreground">None</span>}
              </div>
            </CardContent>
          </Card>
        </div>

        {viewingCustomer.notes && (
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{viewingCustomer.notes}</p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {customerTransactions.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-sm">No transactions yet</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerTransactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.services?.service_name || t.card_type || '—'}</TableCell>
                        <TableCell className="text-right">{formatETB(Number(t.total_price))}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize text-xs ${t.status === 'paid' ? 'bg-success/15 text-success border-success/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">{format(new Date(t.created_at), 'MMM d, yyyy')}</TableCell>
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage customer contacts and view profiles</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number" />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" className="gradient-primary">{editingId ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..." className="pl-9" />
        </div>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} customers</span>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Users className="h-8 w-8 mb-2" />
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="hidden sm:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">{c.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {format(new Date(c.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingCustomer(c)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                              if (confirm('Delete this customer?')) deleteMutation.mutate(c.id);
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

export default Customers;
