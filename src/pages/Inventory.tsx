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
import { Plus, Pencil, Trash2, Package, Search, AlertTriangle, ArrowUp, ArrowDown, RotateCcw, History } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORIES = ['cards', 'ink', 'consumables', 'other'] as const;
const UNITS = ['pcs', 'rolls', 'cartridges', 'bottles', 'boxes', 'sheets'];
const ADJUSTMENT_TYPES = ['add', 'remove', 'damage', 'correction'] as const;

const categoryColors: Record<string, string> = {
  cards: 'bg-primary/15 text-primary border-primary/30',
  ink: 'bg-info/15 text-info border-info/30',
  consumables: 'bg-warning/15 text-warning border-warning/30',
  other: 'bg-muted text-muted-foreground border-border',
};

const categoryIcons: Record<string, string> = {
  cards: '🪪', ink: '🖨️', consumables: '📦', other: '🔧',
};

interface ItemForm {
  name: string;
  category: string;
  quantity: number;
  damaged_quantity: number;
  min_stock_level: number;
  unit: string;
  cost_per_unit: number;
  notes: string;
}

const emptyForm: ItemForm = {
  name: '', category: 'cards', quantity: 0, damaged_quantity: 0,
  min_stock_level: 10, unit: 'pcs', cost_per_unit: 0, notes: '',
};

interface AdjustForm {
  adjustment_type: string;
  quantity_change: number;
  reason: string;
}

const Inventory = () => {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustItemId, setAdjustItemId] = useState<string | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustForm>({ adjustment_type: 'add', quantity_change: 1, reason: '' });
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('inventory_items').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: adjustments = [] } = useQuery({
    queryKey: ['inventory-adjustments', historyItemId],
    enabled: !!historyItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_adjustments')
        .select('*')
        .eq('inventory_item_id', historyItemId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (f: ItemForm) => {
      const { error } = await supabase.from('inventory_items').insert({
        name: f.name.trim(), category: f.category, quantity: f.quantity,
        damaged_quantity: f.damaged_quantity, min_stock_level: f.min_stock_level,
        unit: f.unit, cost_per_unit: f.cost_per_unit, notes: f.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item added'); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, f }: { id: string; f: ItemForm }) => {
      const { error } = await supabase.from('inventory_items').update({
        name: f.name.trim(), category: f.category, quantity: f.quantity,
        damaged_quantity: f.damaged_quantity, min_stock_level: f.min_stock_level,
        unit: f.unit, cost_per_unit: f.cost_per_unit, notes: f.notes.trim() || null,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item updated'); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('inventory_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory'] }); toast.success('Item deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ itemId, adj }: { itemId: string; adj: AdjustForm }) => {
      const item = items.find(i => i.id === itemId);
      if (!item) throw new Error('Item not found');

      let newQty = item.quantity;
      let newDamaged = item.damaged_quantity;

      if (adj.adjustment_type === 'add') {
        newQty += adj.quantity_change;
      } else if (adj.adjustment_type === 'remove') {
        newQty = Math.max(0, newQty - adj.quantity_change);
      } else if (adj.adjustment_type === 'damage') {
        const deduct = Math.min(adj.quantity_change, newQty);
        newQty -= deduct;
        newDamaged += deduct;
      } else if (adj.adjustment_type === 'correction') {
        newQty = adj.quantity_change;
      }

      const { error: adjError } = await supabase.from('inventory_adjustments').insert({
        inventory_item_id: itemId,
        adjustment_type: adj.adjustment_type,
        quantity_change: adj.adjustment_type === 'correction' ? adj.quantity_change - item.quantity : adj.quantity_change,
        reason: adj.reason.trim() || null,
        adjusted_by: user!.id,
      });
      if (adjError) throw adjError;

      const { error: updateError } = await supabase.from('inventory_items')
        .update({ quantity: newQty, damaged_quantity: newDamaged }).eq('id', itemId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] });
      qc.invalidateQueries({ queryKey: ['inventory-adjustments'] });
      toast.success('Stock adjusted');
      setAdjustDialogOpen(false);
      setAdjustForm({ adjustment_type: 'add', quantity_change: 1, reason: '' });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setDialogOpen(false); };

  const handleEdit = (item: typeof items[0]) => {
    setForm({
      name: item.name, category: item.category, quantity: item.quantity,
      damaged_quantity: item.damaged_quantity, min_stock_level: item.min_stock_level,
      unit: item.unit, cost_per_unit: Number(item.cost_per_unit), notes: item.notes || '',
    });
    setEditingId(item.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Item name is required'); return; }
    editingId ? updateMutation.mutate({ id: editingId, f: form }) : createMutation.mutate(form);
  };

  const filtered = items.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === 'all' || i.category === catFilter;
    return matchSearch && matchCat;
  });

  const lowStockItems = items.filter(i => i.quantity <= i.min_stock_level);
  const totalValue = items.reduce((s, i) => s + (i.quantity * Number(i.cost_per_unit)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track ID cards, ink, and consumables</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary"><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingId ? 'Edit Item' : 'Add Item'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Item Name *</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. PVC ID Cards" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input type="number" min={0} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Stock</Label>
                    <Input type="number" min={0} value={form.min_stock_level} onChange={e => setForm(f => ({ ...f, min_stock_level: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cost per Unit ($)</Label>
                    <Input type="number" min={0} step={0.01} value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: parseFloat(e.target.value) || 0 }))} />
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
                  <Button type="submit" className="gradient-primary" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingId ? 'Update' : 'Add'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm">Low Stock Alert</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lowStockItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(' • ')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map(cat => {
          const catItems = items.filter(i => i.category === cat);
          const total = catItems.reduce((s, i) => s + i.quantity, 0);
          return (
            <Card key={cat} className="shadow-card">
              <CardContent className="p-4 text-center">
                <p className="text-2xl mb-1">{categoryIcons[cat]}</p>
                <p className="text-lg font-bold font-heading text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground capitalize">{cat}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..." className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
          <span>{filtered.length} items</span>
          <span>•</span>
          <span className="font-semibold text-foreground">Value: ${totalValue.toFixed(2)}</span>
        </div>
      </div>

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
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Damaged</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Min Level</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Unit Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(item => {
                    const isLow = item.quantity <= item.min_stock_level;
                    return (
                      <TableRow key={item.id} className={isLow ? 'bg-warning/5' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />}
                            <div>
                              <p className="font-medium text-foreground">{item.name}</p>
                              {item.notes && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.notes}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize text-xs ${categoryColors[item.category]}`}>
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity} <span className="text-xs text-muted-foreground">{item.unit}</span>
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-destructive">
                          {item.damaged_quantity > 0 ? item.damaged_quantity : '—'}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell text-muted-foreground">
                          {item.min_stock_level}
                        </TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          ${Number(item.cost_per_unit).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Adjust Stock"
                              onClick={() => { setAdjustItemId(item.id); setAdjustDialogOpen(true); }}>
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="History"
                              onClick={() => { setHistoryItemId(item.id); setHistoryDialogOpen(true); }}>
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            {isAdmin && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => { if (confirm('Delete this item?')) deleteMutation.mutate(item.id); }}>
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

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={(open) => {
        if (!open) { setAdjustForm({ adjustment_type: 'add', quantity_change: 1, reason: '' }); setAdjustItemId(null); }
        setAdjustDialogOpen(open);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!adjustItemId) return;
            adjustMutation.mutate({ itemId: adjustItemId, adj: adjustForm });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Adjustment Type</Label>
              <Select value={adjustForm.adjustment_type} onValueChange={v => setAdjustForm(f => ({ ...f, adjustment_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="add"><span className="flex items-center gap-2"><ArrowUp className="h-3 w-3 text-success" /> Add Stock</span></SelectItem>
                  <SelectItem value="remove"><span className="flex items-center gap-2"><ArrowDown className="h-3 w-3 text-destructive" /> Remove Stock</span></SelectItem>
                  <SelectItem value="damage"><span className="flex items-center gap-2"><AlertTriangle className="h-3 w-3 text-warning" /> Mark Damaged</span></SelectItem>
                  <SelectItem value="correction"><span className="flex items-center gap-2"><RotateCcw className="h-3 w-3 text-info" /> Set Exact Count</span></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{adjustForm.adjustment_type === 'correction' ? 'New Quantity' : 'Quantity'}</Label>
              <Input type="number" min={adjustForm.adjustment_type === 'correction' ? 0 : 1} value={adjustForm.quantity_change}
                onChange={e => setAdjustForm(f => ({ ...f, quantity_change: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={adjustForm.reason} onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))} placeholder="Optional reason" />
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" className="gradient-primary" disabled={adjustMutation.isPending}>Apply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={(open) => {
        if (!open) setHistoryItemId(null);
        setHistoryDialogOpen(open);
      }}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Adjustment History</DialogTitle>
          </DialogHeader>
          {adjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No adjustments recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {adjustments.map(adj => (
                <div key={adj.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <div className="shrink-0 mt-0.5">
                    {adj.adjustment_type === 'add' && <ArrowUp className="h-4 w-4 text-success" />}
                    {adj.adjustment_type === 'remove' && <ArrowDown className="h-4 w-4 text-destructive" />}
                    {adj.adjustment_type === 'damage' && <AlertTriangle className="h-4 w-4 text-warning" />}
                    {adj.adjustment_type === 'correction' && <RotateCcw className="h-4 w-4 text-info" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="capitalize font-medium text-foreground">{adj.adjustment_type}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(adj.created_at), 'MMM d, HH:mm')}</span>
                    </div>
                    <p className="text-muted-foreground">
                      {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                      {adj.reason && ` — ${adj.reason}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Inventory;
