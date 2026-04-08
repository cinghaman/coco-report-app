
// edge-function-append-csv.ts
// Supabase Edge Function (Deno) to append a CSV line for an approved report.
// Deploy with: supabase functions deploy append-csv --no-verify-jwt=false

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { report_id } = await req.json();

    if (!report_id) {
      return new Response(JSON.stringify({ error: "Missing report_id" }), { status: 400 });
    }

    // Fetch report + venue + custom fields flattened
    // RLS will ensure the user can only see reports they are allowed to see.
    const { data: report, error } = await supabase
      .from("daily_reports")
      .select(`*, venues!inner(name, slug)`)
      .eq("id", report_id)
      .single();

    if (error || !report) {
      return new Response(JSON.stringify({ error: error?.message || "Report not found or access denied" }), { status: 400 });
    }

    // Pull custom field values
    const { data: customValues } = await supabase
      .from("report_field_values")
      .select(`value_text, field_definitions(key)`)
      .eq("report_id", report_id);

    const customFlat: Record<string, string> = {};
    for (const row of customValues || []) {
      customFlat[`custom.${row.field_definitions.key}`] = row.value_text ?? "";
    }

    // Must match columns on `daily_reports` + EOD `buildDailyReportSavePayload` (no legacy fields).
    const v = report.venues as { name: string; slug: string };
    const base: Record<string, string | number | null> = {
      report_id: report.id,
      date: report.for_date,
      venue: v.name,
      venue_slug: v.slug,
      total_sale_gross: report.total_sale_gross,
      card_1: report.card_1,
      card_2: report.card_2,
      cash: report.cash,
      flavor: report.flavor,
      cash_deposits: report.cash_deposits,
      przelew: report.przelew,
      glovo: report.glovo,
      uber: report.uber,
      wolt: report.wolt,
      pyszne: report.pyszne,
      bolt: report.bolt,
      total_sale_with_special_payment: report.total_sale_with_special_payment,
      withdrawal: report.withdrawal,
      locker_withdrawal: report.locker_withdrawal,
      deposit: report.deposit,
      staff_cost: report.staff_cost,
      service_10_percent: report.service_10_percent,
      staff_spent: report.staff_spent,
      drawer: report.drawer,
      gross_revenue: report.gross_revenue,
      net_revenue: report.net_revenue,
      cash_previous_day: report.cash_previous_day,
      calculated_cash_expected: report.calculated_cash_expected,
      reconciliation_diff: report.reconciliation_diff,
      status: report.status,
      created_by: report.created_by,
      submitted_at: report.submitted_at,
      approved_by: report.approved_by,
      approved_at: report.approved_at,
      locked_at: report.locked_at,
    };

    const row = { ...base, ...customFlat };

    const yyyy = new Date(report.for_date).getFullYear();
    const mm = String(new Date(report.for_date).getMonth() + 1).padStart(2, '0');
    const key = `coco-${report.venues.slug}-${yyyy}-${mm}-daily-line-items.csv`;

    // Download existing file (if any)
    const { data: existing, error: downloadError } = await supabase.storage
      .from("coco-reports")
      .download(key);

    let csv = "";
    if (!downloadError && existing) {
      csv = await existing.text();
    } else {
      // create header
      csv = Object.keys(row).join(",") + "\n";
    }

    const escape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const line = Object.keys(row).map(k => escape(row[k as keyof typeof row])).join(",") + "\n";
    csv += line;

    // Upload back
    // Note: User must have RLS permission to upload to 'coco-reports' bucket.
    const blob = new Blob([csv], { type: "text/csv" });
    const { error: uploadError } = await supabase.storage
      .from("coco-reports")
      .upload(key, blob, { upsert: true, contentType: "text/csv" });

    if (uploadError) throw uploadError;

    return new Response(JSON.stringify({ ok: true, key }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
