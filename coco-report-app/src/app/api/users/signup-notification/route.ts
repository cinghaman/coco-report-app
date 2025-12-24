import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

/**
 * Endpoint to notify admins when a new user signs up
 * Can be called from client after signup or from database trigger
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, email, displayName } = body

    if (!userId || !email) {
      return NextResponse.json({ error: 'Missing required fields: userId, email' }, { status: 400 })
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get all admin emails
    const { data: adminUsers } = await supabaseAdmin
      .from('users')
      .select('email, display_name, role')
      .in('role', ['admin', 'owner'])

    const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
    
    // Always include these admin emails as fallback/ensure they're included
    const requiredAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
    const allAdminEmails = [...new Set([...adminEmails, ...requiredAdminEmails])] // Remove duplicates
    
    console.log('User signup notification - Admin emails:', {
      fromDatabase: adminEmails,
      totalRecipients: allAdminEmails,
      adminUsersFound: adminUsers?.length || 0
    })

    if (allAdminEmails.length === 0) {
      console.log('No admin users found to notify')
      return NextResponse.json({ message: 'No admins to notify' })
    }

    // Determine app URL for email links
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin)

    // Send email notification to admins using Mailgun directly (server-side)
    const mailgunApiKey = process.env.MAILGUN_API_KEY
    if (!mailgunApiKey) {
      console.error('Mailgun API key not configured')
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
    }

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
        const data = await mg.messages.create(mailgunDomain, {
          from: `${fromName} <${fromEmail}>`,
          to: allAdminEmails,
        subject: `New User Signup - ${displayName || email}`,
        html: `
          <h2>New User Signup</h2>
          <p>A new user has signed up and is awaiting approval.</p>
          <p><strong>Name:</strong> ${displayName || 'N/A'}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p>Please review and approve the user in the admin panel.</p>
          <p><a href="${appUrl}/admin/users" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Review Users</a></p>
        `
      })

      console.log('New user signup email notifications sent successfully:', data.id)
      return NextResponse.json({ message: 'Admins notified successfully' })
    } catch (emailError: any) {
      console.error('Failed to send signup email notifications:', emailError)
      return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
    }

  } catch (error: unknown) {
    console.error('Error in signup notification endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

