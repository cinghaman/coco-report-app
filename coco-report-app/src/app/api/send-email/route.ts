import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

export async function POST(request: NextRequest) {
  try {
    // Verify the request is authenticated
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { to, subject, html, text } = body

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, and html or text' }, { status: 400 })
    }

    // Get Mailgun API key from environment variables
    const mailgunApiKey = process.env.MAILGUN_API_KEY

    if (!mailgunApiKey) {
      console.error('Mailgun API key not configured')
      return NextResponse.json({ 
        error: 'Email service not configured',
        details: 'MAILGUN_API_KEY environment variable must be set'
      }, { status: 500 })
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

    // Handle both single and array of recipients
    const recipients = Array.isArray(to) ? to : [to]
    const results = []

    console.log('Email notification request:', {
      subject,
      recipients: recipients,
      recipientCount: recipients.length,
      authenticatedUser: user.email
    })

    for (const recipient of recipients) {
      try {
        console.log(`Sending email to ${recipient}`)

        const messageData: {
          from: string
          to: string | string[]
          subject: string
          html?: string
          text?: string
        } = {
          from: `${fromName} <${fromEmail}>`,
          to: recipient,
          subject: subject,
        }

        if (html) {
          messageData.html = html
        }
        if (text) {
          messageData.text = text
        }

        const data = await mg.messages.create(mailgunDomain, messageData)

        console.log(`Email sent successfully to ${recipient}:`, data.id)
        results.push({ recipient, success: true, id: data.id })
      } catch (error: any) {
        console.error(`Error sending email to ${recipient}:`, error)
        results.push({ 
          recipient, 
          success: false, 
          error: error?.message || 'Unknown error'
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
