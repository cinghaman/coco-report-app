-- Fix inflated revenue when multiple withdrawals exist per report (JOIN multiplied rows).
CREATE OR REPLACE FUNCTION public.get_daily_analytics_data(
  p_start_date date,
  p_end_date date,
  p_venue_id uuid DEFAULT NULL
)
RETURNS TABLE (
  date date,
  gross_sales numeric,
  tips numeric,
  voids numeric,
  loss numeric,
  withdrawals numeric,
  gross_revenue numeric,
  net_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dr.for_date AS date,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.total_sale_gross ELSE 0 END), 0) AS gross_sales,
    0::numeric AS tips,
    0::numeric AS voids,
    0::numeric AS loss,
    COALESCE((
      SELECT SUM(w.amount)
      FROM public.report_withdrawals w
      INNER JOIN public.daily_reports drw ON drw.id = w.report_id
      WHERE drw.for_date = dr.for_date
        AND drw.status = 'approved'
        AND (p_venue_id IS NULL OR drw.venue_id = p_venue_id)
    ), 0) AS withdrawals,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.gross_revenue ELSE 0 END), 0) AS gross_revenue,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.net_revenue ELSE 0 END), 0) AS net_revenue
  FROM public.daily_reports dr
  WHERE dr.for_date >= p_start_date
    AND dr.for_date <= p_end_date
    AND (p_venue_id IS NULL OR dr.venue_id = p_venue_id)
  GROUP BY dr.for_date
  ORDER BY dr.for_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_venue_analytics_breakdown(
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  venue_id uuid,
  venue_name text,
  total_gross_sales numeric,
  total_gross_revenue numeric,
  total_net_revenue numeric,
  total_reports bigint,
  approved_reports bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id AS venue_id,
    v.name AS venue_name,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.total_sale_gross ELSE 0 END), 0) AS total_gross_sales,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.gross_revenue ELSE 0 END), 0) AS total_gross_revenue,
    COALESCE(SUM(CASE WHEN dr.status = 'approved' THEN dr.net_revenue ELSE 0 END), 0) AS total_net_revenue,
    COUNT(dr.id) AS total_reports,
    COUNT(CASE WHEN dr.status = 'approved' THEN 1 END) AS approved_reports
  FROM public.venues v
  LEFT JOIN public.daily_reports dr
    ON dr.venue_id = v.id
    AND dr.for_date >= p_start_date
    AND dr.for_date <= p_end_date
  WHERE v.is_active = true
  GROUP BY v.id, v.name
  ORDER BY v.name;
END;
$$;
