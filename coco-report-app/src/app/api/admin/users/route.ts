import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    // Get all users from the users table
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('email')

    if (usersError) throw usersError

    // Get auth data for each user
    const usersWithAuth = await Promise.all(
      users.map(async (user) => {
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(user.id)
          return {
            ...user,
            email_confirmed_at: authData?.user?.email_confirmed_at,
            last_sign_in_at: authData?.user?.last_sign_in_at
          }
        } catch (error) {
          console.error(`Error fetching auth data for user ${user.id}:`, error)
          return user
        }
      })
    )

    return NextResponse.json(usersWithAuth)
  } catch (error: unknown) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const { email, password, display_name, role, venue_ids } = await request.json()

    // Validate required fields
    if (!email || !password || !display_name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    if (authError) throw authError

    // Create user profile
    const { data: userData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        display_name,
        role,
        venue_ids: venue_ids || []
      }])
      .select()
      .single()

    if (profileError) throw profileError

    return NextResponse.json(userData)
  } catch (error: unknown) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create user' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const { userId, display_name, role, venue_ids, password } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Update user profile
    const updateData: Record<string, unknown> = {}
    if (display_name !== undefined) updateData.display_name = display_name
    if (role !== undefined) updateData.role = role
    if (venue_ids !== undefined) updateData.venue_ids = venue_ids

    const { data: userData, error: profileError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single()

    if (profileError) throw profileError

    // Update password if provided
    if (password) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password
      })

      if (authError) throw authError
    }

    return NextResponse.json(userData)
  } catch (error: unknown) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Delete user profile first
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (profileError) throw profileError

    // Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) throw authError

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 }
    )
  }
}
