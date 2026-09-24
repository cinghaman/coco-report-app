-- Staff submit EOD reports as approved, then save line items.
-- Previous write policies only allowed staff while status was still draft,
-- so Service (Kwotowy), withdrawals, representacja, and strata were dropped.

CREATE OR REPLACE FUNCTION public.can_write_report_lines(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.daily_reports r
    JOIN public.users u ON u.id = auth.uid()
    WHERE r.id = p_report_id
      AND u.approved = true
      AND (
        u.role = 'owner'::user_role
        OR (
          u.role IN ('admin'::user_role, 'staff'::user_role)
          AND r.venue_id = ANY (u.venue_ids)
        )
      )
  );
$$;

DROP POLICY IF EXISTS p_service_kwotowy_write ON public.report_service_kwotowy;
CREATE POLICY p_service_kwotowy_write ON public.report_service_kwotowy
  FOR ALL
  USING (public.can_write_report_lines(report_id))
  WITH CHECK (public.can_write_report_lines(report_id));

DROP POLICY IF EXISTS p_representacja_1_write ON public.report_representacja_1;
CREATE POLICY p_representacja_1_write ON public.report_representacja_1
  FOR ALL
  USING (public.can_write_report_lines(report_id))
  WITH CHECK (public.can_write_report_lines(report_id));

DROP POLICY IF EXISTS p_strata_write ON public.report_strata;
CREATE POLICY p_strata_write ON public.report_strata
  FOR ALL
  USING (public.can_write_report_lines(report_id))
  WITH CHECK (public.can_write_report_lines(report_id));

DROP POLICY IF EXISTS p_withdrawals_write ON public.report_withdrawals;
CREATE POLICY p_withdrawals_write ON public.report_withdrawals
  FOR ALL
  USING (public.can_write_report_lines(report_id))
  WITH CHECK (public.can_write_report_lines(report_id));

DROP POLICY IF EXISTS p_field_values_write ON public.report_field_values;
CREATE POLICY p_field_values_write ON public.report_field_values
  FOR ALL
  USING (public.can_write_report_lines(report_id))
  WITH CHECK (public.can_write_report_lines(report_id));

-- Staff can correct an already submitted report for their venue.
DROP POLICY IF EXISTS p_reports_update_staff ON public.daily_reports;
CREATE POLICY p_reports_update_staff ON public.daily_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.approved = true
        AND u.role = 'staff'::user_role
        AND daily_reports.venue_id = ANY (u.venue_ids)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.approved = true
        AND u.role = 'staff'::user_role
        AND daily_reports.venue_id = ANY (u.venue_ids)
    )
  );
