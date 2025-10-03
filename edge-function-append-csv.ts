
// edge-function-append-csv.ts
// Supabase Edge Function (Deno) to append a CSV line for an approved report.
// Deploy with: supabase functions deploy append-csv --no-verify-jwt=false

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { report_id } = await req.json();

    // Fetch report + venue + custom fields flattened
    const { data: report, error } = await supabase
      .from("daily_reports")
      .select(`*, venues!inner(name, slug)`)
      .eq("id", report_id)
      .single();

    if (error || !report) {
      return new Response(JSON.stringify({ error: error?.message || "Report not found" }), { status: 400 });
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

    // Compose CSV header order (minimal fixed; custom appended after)
    const base: Record<string, string | number | null> = {
      date: report.for_date,
      venue: report.venues.name,
      total_sale_gross: report.total_sale_gross,
      card_1: report.card_1,
      card_2: report.card_2,
      cash: report.cash,
      przelew: report.przelew,
      glovo: report.glovo,
      uber: report.uber,
      wolt: report.wolt,
      pyszne: report.pyszne,
      bolt: report.bolt,
      tips_cash: report.tips_cash,
      tips_card: report.tips_card,
      withdrawal: report.withdrawal,
      locker_withdrawal: report.locker_withdrawal,
      deposit: report.deposit,
      left_in_drawer: report.left_in_drawer,
      cash_in_envelope_after_tips: report.cash_in_envelope_after_tips,
      total_cash_in_locker: report.total_cash_in_locker,
      voids: report.voids,
      strata_loss: report.strata_loss,
      serwis: report.serwis,
      serwis_k: report.serwis_k,
      company: report.company,
      representation_note: report.representation_note,
      representation_amount: report.representation_amount,
      flavour: report.flavour,
      cash_previous_day: report.cash_previous_day,
      calculated_cash_expected: report.calculated_cash_expected,
      reconciliation_diff: report.reconciliation_diff,
      status: report.status,
      approved_at: report.approved_at
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
      return /[",\n]/.test(s) ? `"\${s.replace(/"/g, '""')}"` : s;
    };

    const line = Object.keys(row).map(k => escape(row[k as keyof typeof row])).join(",") + "\n";
    csv += line;

    // Upload back
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
