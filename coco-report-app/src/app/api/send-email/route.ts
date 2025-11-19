import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify the request is authenticated
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, html, emailOptions } = body

    // Support both simple format (to, subject, html) and full emailOptions
    if (!emailOptions && (!to || !subject || !html)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 })
    }

    // Get SMTP configuration from environment variables
    const smtpHost = process.env.NEXT_PUBLIC_SMTP_HOST
    const smtpUsername = process.env.NEXT_PUBLIC_SMTP_USERNAME
    const smtpPassword = process.env.NEXT_PUBLIC_SMTP_PASSWORD
    const smtpService = process.env.NEXT_PUBLIC_SMTP_SERVICE
    const smtpPort = process.env.NEXT_PUBLIC_SMTP_PORT ? parseInt(process.env.NEXT_PUBLIC_SMTP_PORT) : undefined

    if (!smtpUsername || !smtpPassword || (!smtpService && !smtpHost)) {
      return NextResponse.json({ 
        error: 'SMTP configuration missing',
        details: 'NEXT_PUBLIC_SMTP_USERNAME, NEXT_PUBLIC_SMTP_PASSWORD, and (NEXT_PUBLIC_SMTP_SERVICE or NEXT_PUBLIC_SMTP_HOST) must be set'
      }, { status: 500 })
    }

    // Build email options
    const mailOptions: any = emailOptions || {
      to: Array.isArray(to) ? to : [to],
      from: `"Coco Reporting" <${smtpUsername}>`,
      subject: subject,
      body: html,
      username: smtpUsername,
      password: smtpPassword,
      encrypted: true
    }

    // Add service or host/port
    if (smtpService) {
      mailOptions.service = smtpService
    } else if (smtpHost) {
      mailOptions.host = smtpHost
      mailOptions.secure = true
      if (smtpPort) {
        mailOptions.port = smtpPort
      }
    }

    // Send emails - handle both single and array of recipients
    const recipients = Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to]
    const results = []

    for (const recipient of recipients) {
      try {
        const singleEmailOptions = {
          ...mailOptions,
          to: recipient
        }

        const response = await fetch('https://smtpmailer.vercel.app/api/smtpmailer', {
          method: 'POST',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(singleEmailOptions),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`Failed to send email to ${recipient}:`, response.status, errorText)
          results.push({ recipient, success: false, error: errorText })
        } else {
          const result = await response.json()
          console.log(`Email sent successfully to ${recipient}`)
          results.push({ recipient, success: true, result })
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

