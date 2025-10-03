import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: NextRequest) {
  try {
    // Get existing users from auth
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    
    let staffUserId = null
    let adminUserId = null

    // Find existing users or create new ones
    const existingStaff = existingUsers.users.find(u => u.email === 'staff@example.com')
    const existingAdmin = existingUsers.users.find(u => u.email === 'admin@thoughtbulb.dev')

    if (existingStaff) {
      // Update existing staff user password
      const { data: staffUser, error: staffError } = await supabaseAdmin.auth.admin.updateUserById(
        existingStaff.id,
        { password: 'password123' }
      )
      
      if (staffError) {
        console.error('Staff user password update error:', staffError)
        return NextResponse.json({ error: 'Failed to update staff user password', details: staffError }, { status: 500 })
      }
      
      staffUserId = existingStaff.id
    } else {
      // Create new staff user
      const { data: staffUser, error: staffError } = await supabaseAdmin.auth.admin.createUser({
        email: 'staff@example.com',
        password: 'password123',
        email_confirm: true,
      })

      if (staffError) {
        console.error('Staff user creation error:', staffError)
        return NextResponse.json({ error: 'Failed to create staff user', details: staffError }, { status: 500 })
      }
      
      staffUserId = staffUser.user.id
    }

    if (existingAdmin) {
      // Update existing admin user password
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.updateUserById(
        existingAdmin.id,
        { password: 'password123' }
      )
      
      if (adminError) {
        console.error('Admin user password update error:', adminError)
        return NextResponse.json({ error: 'Failed to update admin user password', details: adminError }, { status: 500 })
      }
      
      adminUserId = existingAdmin.id
    } else {
      // Create new admin user
      const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
        email: 'admin@thoughtbulb.dev',
        password: 'password123',
        email_confirm: true,
      })

      if (adminError) {
        console.error('Admin user creation error:', adminError)
        return NextResponse.json({ error: 'Failed to create admin user', details: adminError }, { status: 500 })
      }
      
      adminUserId = adminUser.user.id
    }

    // Upsert user profiles into users table
    const { error: staffProfileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: staffUserId,
        email: 'staff@example.com',
        role: 'staff',
        display_name: 'Staff User',
        venue_ids: ['7c8cf6f7-74fe-4ec6-9233-3da22c41c157'], // Coco Lounge
      })

    if (staffProfileError) {
      console.error('Staff profile upsert error:', staffProfileError)
    }

    const { error: adminProfileError } = await supabaseAdmin
      .from('users')
      .upsert({
        id: adminUserId,
        email: 'admin@thoughtbulb.dev',
        role: 'admin',
        display_name: 'Admin User',
        venue_ids: ['7c8cf6f7-74fe-4ec6-9233-3da22c41c157', '85ff2a93-7c37-464c-81cb-eea4a15e54c4'], // Both venues
      })

    if (adminProfileError) {
      console.error('Admin profile upsert error:', adminProfileError)
    }

    return NextResponse.json({
      message: 'Users configured successfully',
      staffUser: staffUserId,
      adminUser: adminUserId,
    })

  } catch (error) {
    console.error('User configuration error:', error)
    return NextResponse.json({ error: 'Failed to configure users', details: error }, { status: 500 })
  }
}
