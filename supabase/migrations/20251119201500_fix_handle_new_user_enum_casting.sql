-- Fix the handle_new_user trigger to properly cast enum type
-- This fixes the error: "column role is of type user_role but expression is of type text"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_super_admin boolean;
  user_role user_role;
BEGIN
  is_super_admin := public.is_super_admin(new.email);
  
  -- Properly cast the role to user_role enum
  user_role := CASE WHEN is_super_admin THEN 'owner'::user_role ELSE 'staff'::user_role END;
  
  INSERT INTO public.users (id, email, display_name, role, venue_ids, approved, approved_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    user_role,
    '{}'::uuid[],
    is_super_admin,
    CASE WHEN is_super_admin THEN now() ELSE NULL END
  );
  
  RETURN new;
END;
$$;

