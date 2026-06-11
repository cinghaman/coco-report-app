-- Admins are scoped to assigned venues (users.venue_ids). Owners retain full access.

COMMENT ON COLUMN public.users.venue_ids IS
  'Assigned venue UUIDs. Staff and admins: limits report/cash-report access in the app. Also scopes report/cash-report email notifications for admins/owners; empty means no venue access or emails.';

DROP POLICY IF EXISTS p_reports_admin_all ON public.daily_reports;

CREATE POLICY p_reports_admin_owner_scoped ON public.daily_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.approved = true
        AND (
          u.role = 'owner'::user_role
          OR (
            u.role = 'admin'::user_role
            AND daily_reports.venue_id = ANY (u.venue_ids)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.approved = true
        AND (
          u.role = 'owner'::user_role
          OR (
            u.role = 'admin'::user_role
            AND daily_reports.venue_id = ANY (u.venue_ids)
          )
        )
    )
  );

DROP POLICY IF EXISTS cash_reports_access ON public.cash_reports;

CREATE POLICY cash_reports_access ON public.cash_reports
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'owner'::user_role
          OR (
            u.role = 'admin'::user_role
            AND cash_reports.venue_id = ANY (u.venue_ids)
          )
          OR (
            u.role = 'staff'::user_role
            AND cash_reports.venue_id = ANY (u.venue_ids)
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND (
          u.role = 'owner'::user_role
          OR (
            u.role = 'admin'::user_role
            AND cash_reports.venue_id = ANY (u.venue_ids)
          )
          OR (
            u.role = 'staff'::user_role
            AND cash_reports.venue_id = ANY (u.venue_ids)
          )
        )
    )
  );
