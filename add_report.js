const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'coco-reporting-app', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addReport() {
  try {
    // First, get the venue ID (assuming Coco Lounge)
    const { data: venues, error: venueError } = await supabase
      .from('venues')
      .select('id')
      .eq('name', 'Coco Lounge')
      .limit(1);

    if (venueError || !venues || venues.length === 0) {
      console.error('Error fetching venue:', venueError);
      return;
    }

    const venueId = venues[0].id;

    // Get the admin user ID
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (userError || !users || users.length === 0) {
      console.error('Error fetching admin user:', userError);
      return;
    }

    const userId = users[0].id;

    // Report data based on the provided information
    const reportData = {
      venue_id: venueId,
      for_date: '2025-01-22', // Assuming week 22 of 2025 means January 22, 2025
      status: 'approved',
      
      // Core sales data
      total_sale_gross: 2703.00,
      card_1: 2346.00,
      card_2: 441.00,
      cash: 0.00,
      przelew: 0.00,
      glovo: 104.00, // 149 - 45 = 104
      uber: 0.00,
      wolt: 0.00,
      pyszne: 0.00,
      bolt: 0.00,
      total_sale_with_special_payment: 4290.00,
      
      // Representation
      representation_note: 'Representacja 2',
      representation_amount: 1399.00,
      strata_loss: 0.00,
      flavour: 0.00,
      
      // Cash management
      withdrawal: 0.00,
      locker_withdrawal: 2350.00, // farhan flavour and toilet cleaner
      deposit: 0.00,
      representacja: 0.00,
      staff_cost: 0.00,
      
      // Tips and cash
      tips_cash: 100.00,
      tips_card: 40.00,
      cash_in_envelope_after_tips: 1100.00, // 40 tips paid from card, 290 pending tips paid on 17.09
      left_in_drawer: 130.00,
      total_cash_in_locker: 1500.00,
      
      // Services
      serwis: 53.00,
      serwis_k: 0.00,
      company: 13.00,
      voids: 0.00,
      
      // Carryover (will be calculated)
      cash_previous_day: 0.00,
      calculated_cash_expected: 0.00,
      reconciliation_diff: 0.00,
      
      notes: 'Sales Report - Week 22/2025. Total cash collected: 1399.20. Tips: 40 paid from card, 290 pending tips paid on 17.09.',
      
      created_by: userId,
      submitted_at: new Date().toISOString(),
      approved_by: userId,
      approved_at: new Date().toISOString()
    };

    // Insert the report
    const { data, error } = await supabase
      .from('daily_reports')
      .insert([reportData])
      .select()
      .single();

    if (error) {
      console.error('Error inserting report:', error);
      return;
    }

    console.log('Report added successfully!');
    console.log('Report ID:', data.id);
    console.log('Date:', data.for_date);
    console.log('Total Sales:', data.total_sale_gross);
    console.log('Status:', data.status);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

addReport();
