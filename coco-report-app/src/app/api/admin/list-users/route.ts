import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  try {
    // List all users from auth
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) {
      console.error('List users error:', error)
      return NextResponse.json({ error: 'Failed to list users', details: error }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Users listed successfully',
      users: users.users.map(u => ({ id: u.id, email: u.email, confirmed: !!u.email_confirmed_at }))
    })

  } catch (error) {
    console.error('List users error:', error)
    return NextResponse.json({ error: 'Failed to list users', details: error }, { status: 500 })
  }
}
