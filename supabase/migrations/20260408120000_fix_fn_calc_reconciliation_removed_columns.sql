-- fn_calc_reconciliation referenced dropped columns (total_cash_in_locker, tips_cash, flavour, etc.).
-- Trigger fn_snapshot_reconciliation runs this on submit; fixed to use current daily_reports only.

CREATE OR REPLACE FUNCTION public.fn_calc_reconciliation(p_report uuid)
 RETURNS TABLE(sum_payments numeric, payment_ok boolean, cash_expected numeric, cash_diff numeric, locker_delta numeric, tips_warning boolean)
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  r record;
  tolerance numeric := 0.50;
  cards numeric;
  sp numeric;
  total_representacja_1 numeric;
  cash_exp numeric;
BEGIN
  SELECT * INTO r FROM public.daily_reports WHERE id = p_report;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  cards := r.card_1 + r.card_2;
  sp := r.total_sale_with_special_payment;

  SELECT COALESCE(SUM(amount), 0) INTO total_representacja_1
  FROM public.report_representacja_1
  WHERE report_id = p_report;

  cash_exp := r.cash_previous_day + r.cash + r.deposit - r.locker_withdrawal - r.staff_cost
    - total_representacja_1 - r.flavor - COALESCE(r.withdrawal, 0);

  RETURN QUERY
  SELECT
    (r.card_1 + r.card_2 + r.cash + r.przelew + r.glovo + r.uber + r.wolt + r.pyszne + r.bolt) AS sum_payments,
    ABS((r.card_1 + r.card_2 + r.cash + r.przelew + r.glovo + r.uber + r.wolt + r.pyszne + r.bolt + sp + total_representacja_1) - r.total_sale_gross) <= tolerance AS payment_ok,
    cash_exp AS cash_expected,
    0::numeric AS cash_diff,
    0::numeric AS locker_delta,
    false AS tips_warning;
END;
$function$;
