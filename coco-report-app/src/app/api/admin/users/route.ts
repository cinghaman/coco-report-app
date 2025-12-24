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
          if (!supabaseAdmin) return user
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

    // Get user info before deletion for email notification
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('email, display_name, role')
      .eq('id', userId)
      .single()

    if (fetchError) {
      console.error('Error fetching user to delete:', fetchError)
    }

    // Get current admin info from request (if available)
    // For now, we'll use 'System' as the deleter since this is an admin endpoint
    const deletedBy = 'Admin'

    // Delete user profile first
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (profileError) throw profileError

    // Delete auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authError) throw authError

    // Send email notification to admins about user deletion
    if (userToDelete) {
      try {
        // Get all admin emails
        const { data: adminUsers } = await supabaseAdmin
          .from('users')
          .select('email, display_name')
          .in('role', ['admin', 'owner'])

        const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []

        if (adminEmails.length > 0) {
          // Determine app URL for email links
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin)

          const emailResponse = await fetch(`${appUrl}/api/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: adminEmails,
              subject: `User Deleted - ${userToDelete.display_name || userToDelete.email}`,
              html: `
                <h2>User Deleted</h2>
                <p><strong>Name:</strong> ${userToDelete.display_name || 'N/A'}</p>
                <p><strong>Email:</strong> ${userToDelete.email}</p>
                <p><strong>Role:</strong> ${userToDelete.role}</p>
                <p><strong>Deleted by:</strong> ${deletedBy}</p>
                <p>The user account and all associated data have been permanently deleted.</p>
              `
            })
          })

          if (emailResponse.ok) {
            console.log('User deletion email notifications sent successfully')
          } else {
            const errorData = await emailResponse.json()
            console.error('Failed to send deletion email notifications:', errorData)
          }
        }
      } catch (emailError) {
        console.error('Error sending user deletion email notification:', emailError)
        // Don't fail the deletion if email fails
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 }
    )
  }
}
