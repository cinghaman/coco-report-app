import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if current user is super admin
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('email, role, approved')
            .eq('id', user.id)
            .single()

        if (userError || !currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const superAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
        if (!superAdminEmails.includes(currentUser.email)) {
            return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 })
        }

        // Get user ID to approve from request body
        const { userId, approved } = await request.json()

        if (!userId || typeof approved !== 'boolean') {
            return NextResponse.json(
                { error: 'Missing required fields: userId, approved' },
                { status: 400 }
            )
        }

        // Get user info before updating
        const { data: userToApprove, error: fetchError } = await supabase
            .from('users')
            .select('email, display_name, role')
            .eq('id', userId)
            .single()

        if (fetchError) {
            console.error('Error fetching user to approve:', fetchError)
        }

        // Update user approval status
        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({
                approved,
                approved_by: approved ? user.id : null,
                approved_at: approved ? new Date().toISOString() : null,
            })
            .eq('id', userId)
            .select()
            .single()

        if (updateError) {
            console.error('Error updating user approval:', updateError)
            return NextResponse.json(
                { error: 'Failed to update user approval', details: updateError.message },
                { status: 500 }
            )
        }

        // Send email notification to user when approved directly via Mailgun
        if (approved && userToApprove) {
            try {
                const mailgunApiKey = process.env.MAILGUN_API_KEY
                
                if (mailgunApiKey) {
                    // Determine app URL for email links
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin)

                    const mailgunDomain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
                    const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${mailgunDomain}`
                    const fromName = process.env.MAILGUN_FROM_NAME || 'Coco Reporting'

                    const mailgun = new Mailgun(FormData)
                    const mg = mailgun.client({
                        username: 'api',
                        key: mailgunApiKey,
                        url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net'
                    })

                    const data = await mg.messages.create(mailgunDomain, {
                        from: `${fromName} <${fromEmail}>`,
                        to: userToApprove.email,
                        subject: 'Account Approved - Coco Reporting System',
                        html: `
                            <h2>Account Approved</h2>
                            <p>Hello ${userToApprove.display_name || userToApprove.email},</p>
                            <p>Your account has been approved by an administrator.</p>
                            <p>You can now log in to the Coco Reporting System and start using the platform.</p>
                            <p><a href="${appUrl}/login" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Log In</a></p>
                            <p>If you have any questions, please contact your administrator.</p>
                            <p>Best regards,<br>Coco Reporting Team</p>
                        `
                    })

                    console.log('User approval email sent successfully:', data.id)
                } else {
                    console.warn('Mailgun API key not configured, skipping approval email')
                }
            } catch (emailError) {
                console.error('Error sending approval email:', emailError)
                // Don't fail the approval if email fails
            }
        }

        return NextResponse.json({
            success: true,
            user: updatedUser,
        })
    } catch (error: unknown) {
        console.error('Error in approve user endpoint:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
