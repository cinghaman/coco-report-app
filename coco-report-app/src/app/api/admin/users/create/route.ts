import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
    try {
        // 1. Verify the current user is an admin
        const supabase = await createServerSupabaseClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if current user is super admin
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('email')
            .eq('id', user.id)
            .single()

        if (userError || !currentUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const superAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
        if (!superAdminEmails.includes(currentUser.email)) {
            return NextResponse.json({ error: 'Forbidden: Super admin access required' }, { status: 403 })
        }

        // 2. Parse the request body
        const body = await request.json()
        const { email, password, displayName, role } = body

        if (!email || !password || !displayName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // 3. Create the user using the Service Role Key
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

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email
            user_metadata: {
                display_name: displayName,
                role: role
            }
        })

        if (createError) {
            console.error('Error creating user:', createError)
            return NextResponse.json({ error: createError.message }, { status: 400 })
        }

        // 4. Update the user profile in public.users if needed
        // The trigger might handle insertion, but we might want to ensure fields are set correctly
        // especially 'approved' status since an admin is creating them.

        // Wait a brief moment for trigger to potentially run (optional, but sometimes helpful)
        // Or just upsert the profile to be sure.
        if (newUser.user) {
            const { error: profileError } = await supabaseAdmin
                .from('users')
                .update({
                    display_name: displayName,
                    role: role,
                    approved: true, // Auto-approve since admin created it
                    approved_by: user.id,
                    approved_at: new Date().toISOString()
                })
                .eq('id', newUser.user.id)

            if (profileError) {
                console.error('Error updating user profile:', profileError)
                // Don't fail the request if just profile update fails, but log it
            }
        }

        return NextResponse.json({ user: newUser.user, message: 'User created successfully' })

    } catch (error: unknown) {
        console.error('Error in create user endpoint:', error)
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
