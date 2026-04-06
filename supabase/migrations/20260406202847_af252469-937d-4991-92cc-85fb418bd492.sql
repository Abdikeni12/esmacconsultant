
-- Fix 1: Restrict notification INSERT to own user_id or null
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Fix 2: Drop the existing self-update policy that allows bypassing must_change_password
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate with restricted columns: users can only update full_name and username on their own profile
CREATE POLICY "Users can update own profile safe"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
  AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
  AND must_change_password = (SELECT p.must_change_password FROM public.profiles p WHERE p.id = auth.uid())
);
