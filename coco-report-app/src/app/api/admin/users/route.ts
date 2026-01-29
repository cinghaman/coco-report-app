import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'
import { sendUserCreationEmails, getBaseUrl } from '@/lib/email-user-creation'

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

    if (!email || !password || !display_name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const validRoles = ['staff', 'admin', 'owner']
    const userRole = validRoles.includes(role) ? role : 'staff'

    // Create auth user (handle_new_user trigger inserts into users)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: display_name,
        name: display_name,
        display_name,
        role,
      },
    })

    if (authError) throw authError

    const venueIds = Array.isArray(venue_ids) ? venue_ids : (venue_ids ? [venue_ids] : [])

    // Wait for handle_new_user trigger, then upsert profile (avoids duplicate key)
    await new Promise((r) => setTimeout(r, 500))

    const { error: profileError } = await supabaseAdmin.rpc('upsert_user_profile', {
      p_user_id: authData.user.id,
      p_email: email,
      p_display_name: display_name,
      p_role: userRole,
      p_approved: true,
      p_approved_by: null,
      p_approved_at: new Date().toISOString(),
      p_venue_ids: venueIds,
    })

    if (profileError) throw profileError

    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select()
      .eq('id', authData.user.id)
      .single()

    if (fetchError) throw fetchError

    const baseUrl = getBaseUrl(request)
    const { data: adminUsers } = await supabaseAdmin!
      .from('users')
      .select('email')
      .in('role', ['admin', 'owner'])
    const adminEmails = adminUsers?.map((u) => u.email).filter(Boolean) ?? []

    console.log('[legacy create user] Sending admin + welcome emails (admins=%d, newUser=%s)', adminEmails.length, email)
    const { adminSent, welcomeSent } = await sendUserCreationEmails({
      displayName: display_name,
      email,
      password,
      role: userRole,
      createdBy: 'Admin',
      baseUrl,
      adminEmails,
    })
    if (adminSent && welcomeSent) {
      console.log('[legacy create user] Admin and welcome emails sent successfully')
    } else {
      console.warn('[legacy create user] Emails partially sent:', { adminSent, welcomeSent })
    }

    return NextResponse.json(userData)
  } catch (error: unknown) {
    console.error('Error creating user:', error)
    const err = error as { message?: string; details?: string; code?: string }
    const message = err?.message ?? (error instanceof Error ? error.message : 'Failed to create user')
    return NextResponse.json(
      { error: message, ...(err?.details && { details: err.details }) },
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

    // BEFORE deleting the user, transfer all their reports to an admin
    // Find all reports created by this user (only those still owned by this user)
    const { data: userReports, error: reportsFetchError } = await supabaseAdmin
      .from('daily_reports')
      .select('id, for_date, venue_id, created_by')
      .eq('created_by', userId)

    if (reportsFetchError) {
      console.error('Error fetching user reports:', reportsFetchError)
    }

    let reportsTransferred = 0
    if (userReports && userReports.length > 0) {
      // Find a SINGLE admin user to transfer ALL reports to (prefer owner, then admin)
      // This ensures all reports go to ONE admin, preventing duplication
      const { data: adminUsers, error: adminFetchError } = await supabaseAdmin
        .from('users')
        .select('id, email, role')
        .in('role', ['owner', 'admin'])
        .neq('id', userId) // Exclude the user being deleted
        .order('role', { ascending: true }) // owner first, then admin
        .limit(1) // Only get ONE admin to ensure no duplication

      if (adminFetchError || !adminUsers || adminUsers.length === 0) {
        console.error('Error finding admin user for report transfer:', adminFetchError)
        // If no admin found, we can't transfer - this is a critical error
        return NextResponse.json(
          { 
            error: 'Cannot delete user: No admin user available to transfer reports to',
            details: `User has ${userReports.length} report(s) that need to be transferred`
          },
          { status: 400 }
        )
      }

      const transferToAdminId = adminUsers[0].id
      const transferToAdminEmail = adminUsers[0].email

      // Verify reports are still owned by this user before transfer (safety check)
      const reportsToTransfer = userReports.filter(r => r.created_by === userId)
      
      if (reportsToTransfer.length === 0) {
        console.log('No reports to transfer (may have been already transferred)')
      } else {
        // Transfer ALL reports to the SINGLE admin in one atomic operation
        // This prevents duplication - all reports go to one admin
        const { data: transferResult, error: transferError } = await supabaseAdmin
          .from('daily_reports')
          .update({ created_by: transferToAdminId })
          .eq('created_by', userId)
          .select('id')

        if (transferError) {
          console.error('Error transferring reports to admin:', transferError)
          // This is critical - we shouldn't delete the user if we can't transfer reports
          return NextResponse.json(
            { 
              error: 'Failed to transfer user reports before deletion',
              details: transferError.message 
            },
            { status: 500 }
          )
        }

        reportsTransferred = transferResult?.length || reportsToTransfer.length
        console.log(`Successfully transferred ${reportsTransferred} reports from user ${userId} to admin ${transferToAdminEmail} (single admin, no duplication)`)
      }
    }

    // Delete user profile first
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (profileError) throw profileError

    // Delete auth user (handle case where user might already be deleted)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    // If auth user doesn't exist, that's okay - profile is already deleted
    if (authError && authError.message !== 'User not found') {
      console.warn('Error deleting auth user (may already be deleted):', authError)
      // Don't throw - profile is already deleted, which is the main goal
    }

    // Send email notification to admins about user deletion using Mailgun directly
    if (userToDelete) {
      try {
        // Get all admin emails
        const { data: adminUsers } = await supabaseAdmin
          .from('users')
          .select('email, display_name, role')
          .in('role', ['admin', 'owner'])

        const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
        
        // Always include these admin emails as fallback/ensure they're included
        const requiredAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
        const allAdminEmails = [...new Set([...adminEmails, ...requiredAdminEmails])] // Remove duplicates
        
        console.log('User deletion notification - Admin emails:', {
          fromDatabase: adminEmails,
          totalRecipients: allAdminEmails,
          adminUsersFound: adminUsers?.length || 0
        })

        if (allAdminEmails.length > 0) {
          // Send email directly via Mailgun (no authentication required)
          const mailgunApiKey = process.env.MAILGUN_API_KEY
          
          if (mailgunApiKey) {
            const mailgunDomain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
            const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${mailgunDomain}`
            const fromName = process.env.MAILGUN_FROM_NAME || 'Coco Reporting'

            const mailgun = new Mailgun(FormData)
            const mg = mailgun.client({
              username: 'api',
              key: mailgunApiKey,
              url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net'
            })

            try {
              const reportsInfo = reportsTransferred > 0 
                ? `<p><strong>Reports Transferred:</strong> ${reportsTransferred} report(s) created by this user have been transferred to an admin account to preserve data.</p>`
                : '<p>No reports were associated with this user.</p>'

              const data = await mg.messages.create(mailgunDomain, {
                from: `${fromName} <${fromEmail}>`,
                to: allAdminEmails,
                subject: `User Deleted - ${userToDelete.display_name || userToDelete.email}`,
                html: `
                  <h2>User Deleted</h2>
                  <p><strong>Name:</strong> ${userToDelete.display_name || 'N/A'}</p>
                  <p><strong>Email:</strong> ${userToDelete.email}</p>
                  <p><strong>Role:</strong> ${userToDelete.role}</p>
                  <p><strong>Deleted by:</strong> ${deletedBy}</p>
                  ${reportsInfo}
                  <p>The user account and all associated data have been permanently deleted.</p>
                `
              })

              console.log('User deletion email notifications sent successfully:', data.id)
            } catch (emailError: any) {
              console.error('Error sending user deletion email notification:', emailError)
              // Don't fail the deletion if email fails
            }
          } else {
            console.warn('Mailgun API key not configured, skipping email notification')
          }
        }
      } catch (emailError) {
        console.error('Error sending user deletion email notification:', emailError)
        // Don't fail the deletion if email fails
      }
    }

    return NextResponse.json({ 
      success: true,
      reportsTransferred: reportsTransferred
    })
  } catch (error: unknown) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete user' },
      { status: 500 }
    )
  }
}
