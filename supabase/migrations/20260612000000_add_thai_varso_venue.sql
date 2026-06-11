-- Add Thai Varso location (slug auto-generated as thai-varso)
INSERT INTO public.venues (name, is_active)
VALUES ('Thai Varso', true)
ON CONFLICT (name) DO UPDATE
SET is_active = EXCLUDED.is_active;
