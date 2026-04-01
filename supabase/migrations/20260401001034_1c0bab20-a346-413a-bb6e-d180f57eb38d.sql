
-- Inventory items table
CREATE TABLE public.inventory_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cards' CHECK (category IN ('cards', 'ink', 'consumables', 'other')),
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  damaged_quantity INTEGER NOT NULL DEFAULT 0 CHECK (damaged_quantity >= 0),
  min_stock_level INTEGER NOT NULL DEFAULT 10,
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_per_unit NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inventory"
  ON public.inventory_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert inventory"
  ON public.inventory_items FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update inventory"
  ON public.inventory_items FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete inventory"
  ON public.inventory_items FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inventory adjustments log
CREATE TABLE public.inventory_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('add', 'remove', 'damage', 'correction')),
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view adjustments"
  ON public.inventory_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create adjustments"
  ON public.inventory_adjustments FOR INSERT TO authenticated WITH CHECK (auth.uid() = adjusted_by);

CREATE INDEX idx_inventory_adjustments_item ON public.inventory_adjustments (inventory_item_id);
CREATE INDEX idx_inventory_adjustments_created ON public.inventory_adjustments (created_at DESC);
