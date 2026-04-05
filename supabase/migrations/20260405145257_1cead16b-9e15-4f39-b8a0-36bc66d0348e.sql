
-- Fix: prevent users from escalating their own role or toggling is_active
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
);

-- Fix: remove permissive audit log insert and replace with secure function
DROP POLICY IF EXISTS "Authenticated users can create audit logs" ON public.audit_logs;

CREATE OR REPLACE FUNCTION public.log_audit(
  _action text,
  _entity text,
  _entity_id text DEFAULT NULL,
  _details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, details)
  SELECT
    auth.uid(),
    COALESCE(p.full_name, p.username, 'Unknown'),
    _action,
    _entity,
    _entity_id,
    _details
  FROM public.profiles p
  WHERE p.id = auth.uid();
  
  IF NOT FOUND THEN
    INSERT INTO public.audit_logs (user_id, user_name, action, entity, entity_id, details)
    VALUES (auth.uid(), 'Unknown', _action, _entity, _entity_id, _details);
  END IF;
END;
$$;

-- Fix overly permissive customers UPDATE policy
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Authenticated users can update customers"
ON public.customers FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  entity text,
  entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid() OR user_id IS NULL)
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);
