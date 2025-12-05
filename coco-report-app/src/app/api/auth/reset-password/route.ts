import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

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

    // Generate password reset token using Supabase Admin API
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${request.nextUrl.origin}/auth/reset-password`,
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

    // Send custom email using Resend with the reset link
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.error('Resend API key not configured')
      // Still return success to prevent email enumeration
      return NextResponse.json({ 
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }

    const resend = new Resend(resendApiKey)
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const fromName = process.env.RESEND_FROM_NAME || 'Coco Reporting'

    const resetLink = resetData.properties?.action_link || `${request.nextUrl.origin}/auth/reset-password?token=${resetData.properties?.hashed_token}`
    
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
      const { data, error: emailError } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: email,
        subject: resetSubject,
        html: resetHtml,
      })

      if (emailError) {
        console.error('Error sending reset email:', emailError)
        // Still return success to prevent email enumeration
        return NextResponse.json({ 
          message: 'If an account exists with this email, a password reset link has been sent.'
        })
      }

      console.log('Password reset email sent successfully:', data?.id)
    } catch (emailError) {
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

