import { createServerSupabaseClient } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type') // 'signup' or 'recovery'
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/dashboard'

    if (code) {
        const supabase = await createServerSupabaseClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        
        if (!error && data.user) {
            // If this is a signup verification, notify admins about new user
            if (type === 'signup' || (data.user.email_confirmed_at && !data.user.last_sign_in_at)) {
                try {
                    // Get user profile to check if it's a new signup
                    const { data: userProfile } = await supabase
                        .from('users')
                        .select('email, display_name, approved')
                        .eq('id', data.user.id)
                        .single()

                    // If user exists and is not approved, notify admins
                    if (userProfile && !userProfile.approved) {
                        // Determine app URL
                        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 
                            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin)

                        // Call signup notification API (fire and forget)
                        fetch(`${appUrl}/api/users/signup-notification`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                userId: data.user.id,
                                email: userProfile.email,
                                displayName: userProfile.display_name
                            })
                        }).catch(err => console.error('Error notifying admins of signup:', err))
                    }
                } catch (notifyError) {
                    console.error('Error in signup notification:', notifyError)
                    // Don't fail the auth flow if notification fails
                }
            }

            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=auth-code-error`)
}
