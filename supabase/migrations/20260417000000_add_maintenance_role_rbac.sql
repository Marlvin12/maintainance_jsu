-- Add maintenance role to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'maintenance';

-- Allow maintenance workers to view ALL maintenance requests
CREATE POLICY "Maintenance can view all requests"
ON public.maintenance_requests
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'maintenance'));

-- Allow maintenance workers to update status on requests
-- (they can only set status; column-level security not supported in PG RLS,
--  so we rely on the frontend to restrict which fields they send)
CREATE POLICY "Maintenance can update request status"
ON public.maintenance_requests
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'maintenance'))
WITH CHECK (public.has_role(auth.uid(), 'maintenance'));

-- Allow admins to INSERT new roles for other users (needed for promote/demote)
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to DELETE user roles (needed for promote/demote — delete then re-insert)
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Update handle_new_user so ALL new signups are students (role = 'user')
-- Admins must promote users manually via the Admin Panel
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  -- Always assign student role on signup; admins promote via Admin Panel
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::app_role);

  RETURN NEW;
END;
$$;
