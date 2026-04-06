
-- Trigger function for transaction audit logging
CREATE OR REPLACE FUNCTION public.audit_log_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, details)
  SELECT
    NEW.created_by,
    COALESCE(p.full_name, p.username, 'Unknown'),
    'created',
    'transaction',
    NEW.id::text,
    'Customer: ' || NEW.customer_name || ', Amount: ' || NEW.total_price || ' ETB, Payment: ' || NEW.payment_method
  FROM public.profiles p
  WHERE p.id = NEW.created_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_transaction_insert
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_transaction();

-- Trigger function for inventory update audit logging
CREATE OR REPLACE FUNCTION public.audit_log_inventory_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.quantity IS DISTINCT FROM NEW.quantity OR OLD.damaged_quantity IS DISTINCT FROM NEW.damaged_quantity THEN
    INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, details)
    SELECT
      auth.uid(),
      COALESCE(p.full_name, p.username, 'System'),
      'updated',
      'inventory',
      NEW.id::text,
      NEW.name || ': qty ' || OLD.quantity || ' → ' || NEW.quantity || ', damaged ' || OLD.damaged_quantity || ' → ' || NEW.damaged_quantity
    FROM public.profiles p
    WHERE p.id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_inventory_update
AFTER UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_inventory_update();

-- Trigger function for inventory adjustment audit logging
CREATE OR REPLACE FUNCTION public.audit_log_inventory_adjustment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, details)
  SELECT
    NEW.adjusted_by,
    COALESCE(p.full_name, p.username, 'Unknown'),
    'stock_adjustment',
    'inventory',
    NEW.inventory_item_id::text,
    NEW.adjustment_type || ': ' || NEW.quantity_change || ' units' || COALESCE(', Reason: ' || NEW.reason, '')
  FROM public.profiles p
  WHERE p.id = NEW.adjusted_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_inventory_adjustment
AFTER INSERT ON public.inventory_adjustments
FOR EACH ROW
EXECUTE FUNCTION public.audit_log_inventory_adjustment();

-- Seed default services (only if services table is empty)
INSERT INTO public.services (service_name, category, default_price, affects_inventory, is_active)
SELECT * FROM (VALUES
  ('ID Card Printing', 'printing', 150, true, true),
  ('Passport Photo', 'printing', 100, true, true),
  ('Document Printing A4', 'printing', 5, true, true),
  ('Document Printing Glossy', 'printing', 15, true, true),
  ('Business Licensing', 'licensing', 500, false, true),
  ('Company Registration', 'licensing', 2000, false, true),
  ('Business Consultancy', 'consultancy', 1000, false, true),
  ('Tax Advisory', 'consultancy', 800, false, true)
) AS v(service_name, category, default_price, affects_inventory, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.services LIMIT 1);
