
-- Create a security definer function to get current profile sensitive fields
CREATE OR REPLACE FUNCTION public.get_profile_sensitive_fields(_user_id uuid)
RETURNS TABLE(role text, is_active boolean, must_change_password boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role, p.is_active, p.must_change_password
  FROM public.profiles p
  WHERE p.id = _user_id
  LIMIT 1;
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can update own profile safe" ON public.profiles;

-- Recreate with security definer function
CREATE POLICY "Users can update own profile safe"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT f.role FROM public.get_profile_sensitive_fields(auth.uid()) f)
  AND is_active = (SELECT f.is_active FROM public.get_profile_sensitive_fields(auth.uid()) f)
  AND must_change_password = (SELECT f.must_change_password FROM public.get_profile_sensitive_fields(auth.uid()) f)
);
