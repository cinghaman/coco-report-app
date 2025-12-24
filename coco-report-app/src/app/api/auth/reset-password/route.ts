import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Initialize Supabase admin client to generate reset token
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

    // Determine the correct app URL for redirect
    // Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > request headers > request origin
    let appUrl = request.nextUrl.origin
    
    // Check environment variable first (most reliable)
    if (process.env.NEXT_PUBLIC_APP_URL) {
      appUrl = process.env.NEXT_PUBLIC_APP_URL
    } else if (process.env.VERCEL_URL) {
      // VERCEL_URL is provided by Vercel automatically (e.g., "coco-report-app.vercel.app")
      appUrl = `https://${process.env.VERCEL_URL}`
    } else {
      // Check request headers for the actual host (works in Vercel)
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
      const protocol = request.headers.get('x-forwarded-proto') || 'https'
      
      if (host && !host.includes('localhost')) {
        appUrl = `${protocol}://${host}`
      }
    }
    
    // Log for debugging (remove in production if needed)
    console.log('Password reset URL detection:', {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      VERCEL_URL: process.env.VERCEL_URL || 'not set',
      requestOrigin: request.nextUrl.origin,
      finalAppUrl: appUrl
    })
    
    // Generate password reset token using Supabase Admin API
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${appUrl}/auth/reset-password`,
      }
    })

    if (resetError || !resetData) {
      // Don't reveal if email exists or not for security
      console.error('Password reset error:', resetError)
      // Still return success to prevent email enumeration
      return NextResponse.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }

    // Send custom email using Mailgun with the reset link
    const mailgunApiKey = process.env.MAILGUN_API_KEY

    if (!mailgunApiKey) {
      console.error('Mailgun API key not configured')
      // Still return success to prevent email enumeration
      return NextResponse.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }

    // Get Mailgun domain from environment or use default
    const mailgunDomain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
    const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${mailgunDomain}`
    const fromName = process.env.MAILGUN_FROM_NAME || 'Coco Reporting'

    // Initialize Mailgun
    const mailgun = new Mailgun(FormData)
    const mg = mailgun.client({
      username: 'api',
      key: mailgunApiKey,
      url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net'
    })

    // Construct the reset link manually using our app URL
    // Supabase's action_link may contain localhost from Site URL config, so we build our own
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const token = resetData.properties?.hashed_token
    
    if (!token) {
      console.error('No token received from Supabase generateLink')
      return NextResponse.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }
    
    // Use Supabase's verify endpoint but with our production redirect URL
    // This ensures the link works correctly and redirects to our app
    const resetLink = `${supabaseUrl}/auth/v1/verify?token=${token}&type=recovery&redirect_to=${encodeURIComponent(`${appUrl}/auth/reset-password`)}`
    
    console.log('Reset link constructed:', {
      token: token.substring(0, 10) + '...',
      appUrl,
      resetLink: resetLink.substring(0, 100) + '...'
    })
    
    const resetSubject = 'Password Reset Request - Coco Reporting System'
    const resetHtml = `
      <h2>Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your Coco Reporting System account.</p>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetLink}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Reset Password</a></p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${resetLink}</p>
      <p><strong>Note:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
      <p>Best regards,<br>Coco Reporting Team</p>
    `

    try {
      const data = await mg.messages.create(mailgunDomain, {
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: resetSubject,
        html: resetHtml,
      })

      console.log('Password reset email sent successfully:', data.id)
    } catch (emailError: any) {
      console.error('Error sending reset email:', emailError)
      // Still return success to prevent email enumeration
    }

    return NextResponse.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.'
    })

  } catch (error: unknown) {
    console.error('Error in reset-password endpoint:', error)
    // Return generic message to prevent email enumeration
    return NextResponse.json({ 
      message: 'If an account exists with this email, a password reset link has been sent.'
    })
  }
}

