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
    const { to, subject, html } = body

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 })
    }

    // For now, we'll return success and let the client handle the actual email sending
    // since the SMTP mailer is client-side only
    // In the future, this could be replaced with a server-side email service
    
    return NextResponse.json({ 
      message: 'Email queued for sending',
      // Return the email data so client can send it
      emailData: {
        to,
        subject,
        html
      }
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

