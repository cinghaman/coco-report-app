import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    // Create staff user
    const { data: staffUser, error: staffError } = await supabaseAdmin.auth.admin.createUser({
      email: 'staff@example.com',
      password: 'password123',
      email_confirm: true,
    })

    if (staffError) {
      console.error('Staff user creation error:', staffError)
      return NextResponse.json({ error: 'Failed to create staff user', details: staffError }, { status: 500 })
    }

    // Insert user profile into users table
    const { error: staffProfileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: staffUser.user.id,
        email: 'staff@example.com',
        role: 'staff',
        display_name: 'Staff User',
        venue_ids: ['7c8cf6f7-74fe-4ec6-9233-3da22c41c157'], // Coco Lounge
      })

    if (staffProfileError) {
      console.error('Staff profile upsert error:', staffProfileError)
    }

    return NextResponse.json({
      message: 'Staff user created successfully',
      staffUser: staffUser.user.id,
    })

  } catch (error) {
    console.error('Staff user creation error:', error)
    return NextResponse.json({ error: 'Failed to create staff user', details: error }, { status: 500 })
  }
}
