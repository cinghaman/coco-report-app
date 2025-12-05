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

        // 4. Upsert the user profile in public.users using RPC function
        // The trigger handles insertion, but we need to ensure fields are set correctly
        // especially 'approved' status and role since an admin is creating them.
        // Use RPC function to properly handle enum type casting
        if (newUser.user) {
            // Validate role
            const validRoles = ['staff', 'admin', 'owner']
            const userRole = validRoles.includes(role) ? role : 'staff'
            
            // Wait a moment for trigger to complete (if it hasn't already)
            await new Promise(resolve => setTimeout(resolve, 300))
            
            // Use upsert RPC function which handles enum casting properly
            const { error: profileError } = await supabaseAdmin.rpc('upsert_user_profile', {
                p_user_id: newUser.user.id,
                p_email: email,
                p_display_name: displayName,
                p_role: userRole,
                p_approved: true, // Auto-approve since admin created it
                p_approved_by: user.id,
                p_approved_at: new Date().toISOString(),
                p_venue_ids: []
            })

            if (profileError) {
                console.error('Error upserting user profile:', profileError)
                return NextResponse.json({ 
                    error: 'Database error creating new user',
                    details: profileError.message 
                }, { status: 500 })
            }
        }

        // Send email notifications
        try {
            // 1. Notify admins about new user
            const { data: adminUsers } = await supabaseAdmin
                .from('users')
                .select('email, display_name')
                .in('role', ['admin', 'owner'])

            const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
            
            if (adminEmails.length > 0) {
                const adminSubject = `New User Created - ${displayName}`
                const adminHtml = `
                    <h2>New User Created</h2>
                    <p><strong>Name:</strong> ${displayName}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Role:</strong> ${role}</p>
                    <p><strong>Created by:</strong> ${currentUser.email}</p>
                    <p>The user has been automatically approved and can now log in.</p>
                `

                await fetch(`${request.nextUrl.origin}/api/send-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: adminEmails,
                        subject: adminSubject,
                        html: adminHtml
                    })
                })
            }

            // 2. Send welcome email to new user with password setup instructions
            const welcomeSubject = 'Welcome to Coco Reporting System'
            const welcomeHtml = `
                <h2>Welcome to Coco Reporting System!</h2>
                <p>Hello ${displayName},</p>
                <p>Your account has been created successfully.</p>
                <p><strong>Your login credentials:</strong></p>
                <ul>
                    <li><strong>Email:</strong> ${email}</li>
                    <li><strong>Password:</strong> ${password}</li>
                </ul>
                <p><strong>Important:</strong> Please change your password after your first login for security.</p>
                <p>You can log in at: <a href="${request.nextUrl.origin}/login">${request.nextUrl.origin}/login</a></p>
                <p>If you have any questions, please contact your administrator.</p>
                <p>Best regards,<br>Coco Reporting Team</p>
            `

            await fetch(`${request.nextUrl.origin}/api/send-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email,
                    subject: welcomeSubject,
                    html: welcomeHtml
                })
            })
        } catch (emailError) {
            console.error('Error sending email notifications:', emailError)
            // Don't fail user creation if email fails
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
