import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    // List users to get the correct IDs
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
      console.error('List users error:', listError)
      return NextResponse.json({ error: 'Failed to list users', details: listError }, { status: 500 })
    }

    // Find users by email
    const staffUser = users.users.find(u => u.email === 'staff@example.com')
    const adminUser = users.users.find(u => u.email === 'admin@thoughtbulb.dev')

    let staffResult = null
    let adminResult = null

    if (staffUser) {
      // Update staff user password
      const { data: staffUpdate, error: staffError } = await supabaseAdmin.auth.admin.updateUserById(
        staffUser.id,
        { password: 'password123' }
      )
      
      if (staffError) {
        console.error('Staff user password update error:', staffError)
        return NextResponse.json({ error: 'Failed to update staff user password', details: staffError }, { status: 500 })
      }
      
      staffResult = staffUpdate.user?.id
    }

    if (adminUser) {
      // Update admin user password
      const { data: adminUpdate, error: adminError } = await supabaseAdmin.auth.admin.updateUserById(
        adminUser.id,
        { password: 'password123' }
      )
      
      if (adminError) {
        console.error('Admin user password update error:', adminError)
        return NextResponse.json({ error: 'Failed to update admin user password', details: adminError }, { status: 500 })
      }
      
      adminResult = adminUpdate.user?.id
    }

    return NextResponse.json({
      message: 'Passwords updated successfully',
      staffUser: staffResult,
      adminUser: adminResult,
      foundUsers: {
        staff: !!staffUser,
        admin: !!adminUser
      }
    })

  } catch (error) {
    console.error('Password update error:', error)
    return NextResponse.json({ error: 'Failed to update passwords', details: error }, { status: 500 })
  }
}
