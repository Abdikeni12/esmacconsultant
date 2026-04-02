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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, AlertTriangle, Search } from 'lucide-react';
import { formatETB } from '@/lib/currency';

const CATEGORIES = [
  { value: 'cards', label: 'ID Cards' },
  { value: 'paper_a4', label: 'A4 Papers' },
  { value: 'paper_glossy', label: 'Glossy Papers' },
  { value: 'ink', label: 'Ink' },
  { value: 'consumables', label: 'Consumables' },
];

const UNITS = ['pcs', 'reams', 'cartridges', 'rolls', 'boxes', 'liters'];

interface ItemForm {
  name: string;
  category: string;
  quantity: number;
  damaged_quantity: number;
  min_stock_level: number;
  cost_per_unit: number;
  unit: string;
  notes: string;
}

const emptyForm: ItemForm = {
  name: '', category: 'cards', quantity: 0, damaged_quantity: 0,
  min_stock_level: 10, cost_per_unit: 0, unit: 'pcs', notes: '',
};

const Inventory = () => {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Adjustment dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustItemId, setAdjustItemId] = useState<string | null>(null);
  const [adjustType, setAdjustType] = useState<'add' | 'deduct' | 'damaged'>('add');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory_items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_items').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (form: ItemForm) => {
      const { error } = await supabase.from('inventory_items').insert({
        name: form.name.trim(),
        category: form.category,
        quantity: form.quantity,
        damaged_quantity: form.damaged_quantity,
        min_stock_level: form.min_stock_level,
        cost_per_unit: form.cost_per_unit,
        unit: form.unit,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory_items'] }); toast.success('Item added'); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: ItemForm }) => {
      const { error } = await supabase.from('inventory_items').update({
        name: form.name.trim(),
        category: form.category,
        quantity: form.quantity,
        damaged_quantity: form.damaged_quantity,
        min_stock_level: form.min_stock_level,
        cost_per_unit: form.cost_per_unit,
        unit: form.unit,
        notes: form.notes.trim() || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory_items'] }); toast.success('Item updated'); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['inventory_items'] }); toast.success('Item deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!adjustItemId || !user) return;
      const item = items.find(i => i.id === adjustItemId);
      if (!item) return;

      let qtyChange = adjustQty;
      let newQty = item.quantity;
      let newDamaged = item.damaged_quantity;

      if (adjustType === 'add') {
        newQty += adjustQty;
      } else if (adjustType === 'deduct') {
        qtyChange = -adjustQty;
        newQty = Math.max(0, newQty - adjustQty);
      } else if (adjustType === 'damaged') {
        qtyChange = -adjustQty;
        newQty = Math.max(0, newQty - adjustQty);
        newDamaged += adjustQty;
      }

      const { error: adjErr } = await supabase.from('inventory_adjustments').insert({
        inventory_item_id: adjustItemId,
        adjustment_type: adjustType,
        quantity_change: qtyChange,
        adjusted_by: user.id,
        reason: adjustReason.trim() || null,
      });
      if (adjErr) throw adjErr;

      const { error: updErr } = await supabase.from('inventory_items').update({
        quantity: newQty,
        damaged_quantity: newDamaged,
      }).eq('id', adjustItemId);
      if (updErr) throw updErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory_items'] });
      toast.success('Stock adjusted');
      setAdjustOpen(false);
      setAdjustQty(0);
      setAdjustReason('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(false); };

  const handleEdit = (item: typeof items[0]) => {
    setForm({
      name: item.name, category: item.category, quantity: item.quantity,
      damaged_quantity: item.damaged_quantity, min_stock_level: item.min_stock_level,
      cost_per_unit: Number(item.cost_per_unit), unit: item.unit, notes: item.notes || '',
    });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    if (editingId) updateMutation.mutate({ id: editingId, form });
    else createMutation.mutate(form);
  };

  const filtered = items.filter(item => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const lowStockItems = items.filter(i => i.quantity <= i.min_stock_level);
  const totalValue = items.reduce((sum, i) => sum + i.quantity * Number(i.cost_per_unit), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track ID cards, papers, ink, and consumables</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingId ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock Level</Label>
                    <Input type="number" min={0} value={form.min_stock_level} onChange={e => setForm(f => ({ ...f, min_stock_level: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cost/Unit (ETB)</Label>
                    <Input type="number" min={0} step={0.01} value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Damaged Qty</Label>
                    <Input type="number" min={0} value={form.damaged_quantity} onChange={e => setForm(f => ({ ...f, damaged_quantity: parseInt(e.target.value) || 0 }))} />
                  </div>
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
        )}
      </div>

      {/* Low stock alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <p className="font-semibold text-warning text-sm">Low Stock Alerts ({lowStockItems.length})</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(i => (
                <Badge key={i.id} variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  {i.name}: {i.quantity} {i.unit} (min: {i.min_stock_level})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
          <span>{filtered.length} items</span>
          <span>•</span>
          <span className="font-semibold text-foreground">{formatETB(totalValue)} total value</span>
        </div>
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjustType} onValueChange={v => setAdjustType(v as 'add' | 'deduct' | 'damaged')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="deduct">Deduct Stock</SelectItem>
                  <SelectItem value="damaged">Mark Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={adjustQty} onChange={e => setAdjustQty(parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Optional reason" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
              <Button className="gradient-primary" onClick={() => adjustMutation.mutate()} disabled={adjustQty <= 0}>
                Apply
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Package className="h-8 w-8 mb-2" />
              <p className="text-sm">No inventory items found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Damaged</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Cost/Unit</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => {
                    const isLow = item.quantity <= item.min_stock_level;
                    const catLabel = CATEGORIES.find(c => c.value === item.category)?.label || item.category;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground sm:hidden">{catLabel}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{catLabel}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-destructive">{item.damaged_quantity}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">{formatETB(Number(item.cost_per_unit))}</TableCell>
                        <TableCell className="text-right hidden md:table-cell font-medium">{formatETB(item.quantity * Number(item.cost_per_unit))}</TableCell>
                        <TableCell>
                          {isLow ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-xs">Low</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-xs">OK</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                              setAdjustItemId(item.id);
                              setAdjustOpen(true);
                            }}>
                              Adjust
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                                  if (confirm('Delete this item?')) deleteMutation.mutate(item.id);
                                }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Inventory;
