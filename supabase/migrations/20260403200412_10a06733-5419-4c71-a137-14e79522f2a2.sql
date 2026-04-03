
-- 1. Services table
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name text NOT NULL,
  category text NOT NULL DEFAULT 'printing',
  default_price numeric NOT NULL DEFAULT 0,
  affects_inventory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view services" ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update services" ON public.services FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete services" ON public.services FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Customers table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update customers" ON public.customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can delete customers" ON public.customers FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Audit logs table
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Authenticated users can create audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Update transactions table
ALTER TABLE public.transactions ADD COLUMN service_id uuid REFERENCES public.services(id);
ALTER TABLE public.transactions ADD COLUMN payment_method text NOT NULL DEFAULT 'Cash';
ALTER TABLE public.transactions ADD COLUMN customer_id uuid REFERENCES public.customers(id);
ALTER TABLE public.transactions ALTER COLUMN card_type DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN card_type SET DEFAULT NULL;

-- 5. Seed default services
INSERT INTO public.services (service_name, category, default_price, affects_inventory) VALUES
  ('Standard ID Card', 'printing', 150, true),
  ('Student ID Card', 'printing', 100, true),
  ('Employee ID Card', 'printing', 200, true),
  ('Government ID Card', 'printing', 250, true),
  ('Membership Card', 'printing', 120, true),
  ('Access Card', 'printing', 180, true),
  ('Document Printing (A4)', 'printing', 5, true),
  ('Photo Printing (Glossy)', 'printing', 15, true),
  ('Business License Renewal', 'licensing', 500, false),
  ('Trade License', 'licensing', 800, false),
  ('Business Consultancy', 'consultancy', 1000, false),
  ('Tax Consultation', 'consultancy', 750, false);
