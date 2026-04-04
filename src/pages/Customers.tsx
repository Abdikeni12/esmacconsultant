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
import { Plus, Pencil, Trash2, Users, Search, Eye } from 'lucide-react';
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
  const [viewCustomerId, setViewCustomerId] = useState<string | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select('*, services(service_name)').order('created_at', { ascending: false });
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

  const handleEdit = (c: typeof customers[0]) => {
    setForm({ full_name: c.full_name, phone: c.phone || '', notes: c.notes || '' });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    if (editingId) updateMutation.mutate({ id: editingId, f: form });
    else createMutation.mutate(form);
  };

  const filtered = customers.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search))
  );

  // Customer profile view
  const viewCustomer = customers.find(c => c.id === viewCustomerId);
  const customerTxs = allTransactions.filter((t: any) => t.customer_name === viewCustomer?.full_name);
  const customerTotal = customerTxs.reduce((s: number, t: any) => t.status !== 'cancelled' ? s + Number(t.total_price) : s, 0);
  const customerServices = [...new Set(customerTxs.map((t: any) => t.services?.service_name).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage customer contacts and profiles</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
          <DialogTrigger asChild>
            <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" /> Add Customer</Button>
          </DialogTrigger>
          <DialogContent>
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
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" className="gradient-primary">{editingId ? 'Update' : 'Add'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone..." className="pl-9" />
      </div>

      {/* Customer Profile Dialog */}
      <Dialog open={!!viewCustomerId} onOpenChange={(open) => { if (!open) setViewCustomerId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Customer Profile</DialogTitle>
          </DialogHeader>
          {viewCustomer && (
            <div className="space-y-4">
              <div>
                <p className="text-lg font-bold text-foreground">{viewCustomer.full_name}</p>
                {viewCustomer.phone && <p className="text-sm text-muted-foreground">{viewCustomer.phone}</p>}
                {viewCustomer.notes && <p className="text-sm text-muted-foreground mt-1">{viewCustomer.notes}</p>}
                <p className="text-xs text-muted-foreground mt-1">Customer since {format(new Date(viewCustomer.created_at), 'MMM d, yyyy')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Card className="shadow-card">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Total Spending</p>
                    <p className="text-lg font-bold font-heading">{formatETB(customerTotal)}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Transactions</p>
                    <p className="text-lg font-bold font-heading">{customerTxs.length}</p>
                  </CardContent>
                </Card>
              </div>
              {customerServices.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Services Used</p>
                  <div className="flex flex-wrap gap-1">
                    {customerServices.map(s => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>
                </div>
              )}
              {customerTxs.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Transaction History</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customerTxs.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm border-b pb-2">
                        <div>
                          <p className="text-foreground">{tx.services?.service_name || '—'}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'MMM d, yyyy')}</p>
                        </div>
                        <p className="font-medium">{formatETB(Number(tx.total_price))}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                    <TableHead className="hidden sm:table-cell">Notes</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">{c.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.phone || '—'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs max-w-[200px] truncate">{c.notes || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{format(new Date(c.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewCustomerId(c.id)}>
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
