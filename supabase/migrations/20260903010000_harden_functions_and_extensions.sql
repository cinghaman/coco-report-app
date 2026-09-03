-- Address Supabase security advisor WARNs. Nothing here drops data or tables.
-- Every change is reversible and keeps the app's existing access paths:
--   * service_role (server routes using supabaseAdmin) keeps EXECUTE
--   * authenticated (logged-in users) keeps EXECUTE
--   * only the unauthenticated `anon` role and the implicit PUBLIC grant are removed
--   * trigger functions on auth.users stay executable by supabase_auth_admin

-- 1) function_search_path_mutable: pin search_path on functions that lacked it.
--    Bodies are already schema-qualified, so behaviour is unchanged.
ALTER FUNCTION public.is_super_admin(text)            SET search_path = public;
ALTER FUNCTION public.current_user_is_super_admin()   SET search_path = public;
ALTER FUNCTION public.current_user_role()             SET search_path = public;
ALTER FUNCTION public.get_pending_users()             SET search_path = public;
ALTER FUNCTION public.fn_calc_reconciliation(uuid)    SET search_path = public;
ALTER FUNCTION public.fn_snapshot_reconciliation()    SET search_path = public;

-- 2) anon_security_definer_function_executable: unauthenticated callers must not
--    be able to invoke SECURITY DEFINER functions via /rest/v1/rpc.
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.current_user_is_admin_or_owner()',
    'public.fn_prev_day_cash(uuid, date)',
    'public.fn_prev_day_total_cash(uuid, date)',
    'public.get_analytics_data(date, date, uuid)',
    'public.get_daily_analytics_data(date, date, uuid)',
    'public.get_venue_analytics_breakdown(date, date)',
    'public.get_pending_users()',
    'public.log_password_change(uuid, text, inet, text, boolean, text)',
    'public.log_password_reset_completed(uuid, text, inet, text, boolean, text)',
    'public.log_password_reset_request(uuid, text, inet, text, boolean, text)',
    'public.update_user_profile(uuid, text, text, boolean, uuid, timestamptz)',
    'public.upsert_user_profile(uuid, text, text, text, boolean, uuid, timestamptz, uuid[])'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;

  -- Trigger functions: never called over the API; keep them for the roles that fire them.
  FOREACH f IN ARRAY ARRAY[
    'public.handle_new_user()',
    'public.notify_admins_new_user_signup()',
    'public.trigger_notify_admins_new_user()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, supabase_auth_admin', f);
  END LOOP;
END $$;

-- 3) extension_in_public: move moddatetime out of public. Existing triggers
--    (trg_daily_reports_updated_at, trg_report_withdrawals_updated_at) reference
--    the function by OID and keep working.
ALTER EXTENSION moddatetime SET SCHEMA extensions;

-- 4) auth_leaked_password_protection is an Auth dashboard setting, not SQL:
--    Authentication -> Providers -> Email -> "Prevent use of leaked passwords".
