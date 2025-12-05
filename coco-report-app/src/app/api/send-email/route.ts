import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { Resend } from 'resend'

export async function POST(request: NextRequest) {
  try {
    // Verify the request is authenticated
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, html } = body

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 })
    }

    // Get Resend API key from environment variables
    const resendApiKey = process.env.RESEND_API_KEY

    if (!resendApiKey) {
      console.error('Resend API key not configured')
      return NextResponse.json({ 
        error: 'Email service not configured',
        details: 'RESEND_API_KEY environment variable must be set'
      }, { status: 500 })
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey)

    // Get from email from environment or use default
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const fromName = process.env.RESEND_FROM_NAME || 'Coco Reporting'

    // Handle both single and array of recipients
    const recipients = Array.isArray(to) ? to : [to]
    const results = []

    for (const recipient of recipients) {
      try {
        console.log(`Sending email to ${recipient}`)

        const { data, error } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: recipient,
          subject: subject,
          html: html,
        })

        if (error) {
          console.error(`Failed to send email to ${recipient}:`, error)
          results.push({ 
            recipient, 
            success: false, 
            error: error.message || 'Unknown error'
          })
        } else {
          console.log(`Email sent successfully to ${recipient}:`, data?.id)
          results.push({ recipient, success: true, id: data?.id })
        }
      } catch (error) {
        console.error(`Error sending email to ${recipient}:`, error)
        results.push({ 
          recipient, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const totalCount = results.length

    return NextResponse.json({ 
      message: `Email sending completed: ${successCount}/${totalCount} sent successfully`,
      results
    })

  } catch (error: unknown) {
    console.error('Error in send-email endpoint:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
