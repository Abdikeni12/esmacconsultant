
-- Security definer function to mark password changed (only for the calling user)
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET must_change_password = false, updated_at = now()
  WHERE id = auth.uid();
END;
$$;
