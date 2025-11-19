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
    // Note: NEXT_PUBLIC_ vars are available on server, but we should also check non-prefixed versions
    const smtpHost = process.env.NEXT_PUBLIC_SMTP_HOST || process.env.SMTP_HOST
    const smtpUsername = process.env.NEXT_PUBLIC_SMTP_USERNAME || process.env.SMTP_USERNAME
    const smtpPassword = process.env.NEXT_PUBLIC_SMTP_PASSWORD || process.env.SMTP_PASSWORD
    const smtpService = process.env.NEXT_PUBLIC_SMTP_SERVICE || process.env.SMTP_SERVICE
    const smtpPort = (process.env.NEXT_PUBLIC_SMTP_PORT || process.env.SMTP_PORT) 
      ? parseInt(process.env.NEXT_PUBLIC_SMTP_PORT || process.env.SMTP_PORT || '465') 
      : undefined

    console.log('SMTP Config Check:', {
      hasHost: !!smtpHost,
      hasUsername: !!smtpUsername,
      hasPassword: !!smtpPassword,
      hasService: !!smtpService,
      port: smtpPort
    })

    if (!smtpUsername || !smtpPassword || (!smtpService && !smtpHost)) {
      console.error('SMTP configuration missing:', {
        username: !!smtpUsername,
        password: !!smtpPassword,
        service: !!smtpService,
        host: !!smtpHost
      })
      return NextResponse.json({ 
        error: 'SMTP configuration missing',
        details: 'NEXT_PUBLIC_SMTP_USERNAME, NEXT_PUBLIC_SMTP_PASSWORD, and (NEXT_PUBLIC_SMTP_SERVICE or NEXT_PUBLIC_SMTP_HOST) must be set',
        config: {
          hasUsername: !!smtpUsername,
          hasPassword: !!smtpPassword,
          hasService: !!smtpService,
          hasHost: !!smtpHost
        }
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

        // Remove 'to' from the array format since we're sending to a single recipient
        delete singleEmailOptions.to
        singleEmailOptions.to = recipient

        console.log(`Sending email to ${recipient} with options:`, {
          to: recipient,
          from: singleEmailOptions.from,
          subject: singleEmailOptions.subject,
          hasUsername: !!singleEmailOptions.username,
          hasPassword: !!singleEmailOptions.password,
          encrypted: singleEmailOptions.encrypted,
          service: singleEmailOptions.service,
          host: singleEmailOptions.host
        })

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
          console.error(`Failed to send email to ${recipient}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          })
          results.push({ 
            recipient, 
            success: false, 
            error: errorText,
            status: response.status,
            statusText: response.statusText
          })
        } else {
          const result = await response.json()
          console.log(`Email sent successfully to ${recipient}:`, result)
          results.push({ recipient, success: true, result })
        }
      } catch (error) {
        console.error(`Error sending email to ${recipient}:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
        results.push({ 
          recipient, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: error instanceof Error ? error.constructor.name : typeof error
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

