import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

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
        const { email, password, displayName, role, venue_ids } = body

        console.log('User creation request received:', {
            email,
            displayName,
            role,
            venue_ids,
            venue_ids_type: typeof venue_ids,
            venue_ids_is_array: Array.isArray(venue_ids)
        })

        if (!email || !password || !displayName || !role) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Validate venue_ids is an array if provided
        const venueIds = Array.isArray(venue_ids) ? venue_ids : (venue_ids ? [venue_ids] : [])
        
        console.log('Processed venue IDs:', venueIds)

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
                full_name: displayName, // Trigger looks for 'full_name' in metadata
                name: displayName, // Fallback for trigger
                display_name: displayName, // Also set display_name for consistency
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
            // The trigger creates a basic profile, then we update it with correct values
            await new Promise(resolve => setTimeout(resolve, 500))
            
            // Check if profile already exists (created by trigger)
            const { data: existingProfile } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('id', newUser.user.id)
                .single()
            
            if (existingProfile) {
                // Profile exists (created by trigger), just UPDATE it
                console.log('Profile exists, updating with:', {
                    display_name: displayName,
                    role: userRole,
                    venue_ids: venueIds,
                    venue_ids_count: venueIds.length
                })
                
                const { error: updateError } = await supabaseAdmin
                    .from('users')
                    .update({
                        email: email,
                        display_name: displayName,
                        role: userRole as any, // Cast to enum type
                        approved: true,
                        approved_by: user.id,
                        approved_at: new Date().toISOString(),
                        venue_ids: venueIds
                    })
                    .eq('id', newUser.user.id)
                
                if (updateError) {
                    console.error('Error updating user profile:', updateError)
                    return NextResponse.json({ 
                        error: 'Database error updating user profile',
                        details: updateError.message 
                    }, { status: 500 })
                }
                
                console.log('User profile updated successfully')
            } else {
                // Profile doesn't exist yet, use RPC function to create it
                console.log('Profile does not exist, creating with RPC:', {
                    p_user_id: newUser.user.id,
                    p_email: email,
                    p_display_name: displayName,
                    p_role: userRole,
                    p_venue_ids: venueIds,
                    venue_ids_count: venueIds.length
                })
                
                const { data: rpcResult, error: profileError } = await supabaseAdmin.rpc('upsert_user_profile', {
                    p_user_id: newUser.user.id,
                    p_email: email,
                    p_display_name: displayName,
                    p_role: userRole,
                    p_approved: true,
                    p_approved_by: user.id,
                    p_approved_at: new Date().toISOString(),
                    p_venue_ids: venueIds
                })
                
                console.log('RPC upsert_user_profile result:', { rpcResult, profileError: profileError?.message })

                if (profileError) {
                    console.error('Error upserting user profile:', profileError)
                    return NextResponse.json({ 
                        error: 'Database error creating new user',
                        details: profileError.message 
                    }, { status: 500 })
                }
            }
            
            // Verify the profile was created correctly
            const { data: createdProfile, error: verifyError } = await supabaseAdmin
                .from('users')
                .select('id, email, display_name, role, venue_ids')
                .eq('id', newUser.user.id)
                .single()
            
            if (verifyError) {
                console.error('Error verifying user profile:', verifyError)
            } else {
                console.log('User profile created successfully:', {
                    id: createdProfile.id,
                    email: createdProfile.email,
                    display_name: createdProfile.display_name,
                    role: createdProfile.role,
                    venue_ids: createdProfile.venue_ids,
                    venue_count: createdProfile.venue_ids?.length || 0
                })
                
                // If display_name or venue_ids are missing, log a warning
                if (!createdProfile.display_name) {
                    console.warn('WARNING: display_name is missing in created profile')
                }
                if (!createdProfile.venue_ids || createdProfile.venue_ids.length === 0) {
                    console.warn('WARNING: venue_ids is empty in created profile, expected:', venueIds)
                }
            }
        } else {
            console.error('newUser.user is null or undefined')
            return NextResponse.json({ 
                error: 'User creation failed - no user returned'
            }, { status: 500 })
        }

        // Return success response IMMEDIATELY (before emails) so user creation succeeds even if emails fail
        // This prevents 500 errors from email issues
        const successResponse = NextResponse.json({ 
            user: newUser.user, 
            message: 'User created successfully',
            displayName: displayName,
            venueIds: venueIds
        })

        // Send email notifications directly via Mailgun (fire-and-forget, non-blocking)
        // Don't await - let it run in background so user creation response isn't delayed
        // Wrap in Promise.resolve().then() to ensure it doesn't block the response
        Promise.resolve().then(async () => {
            try {
                const mailgunApiKey = process.env.MAILGUN_API_KEY
                
                if (!mailgunApiKey) {
                    console.warn('Mailgun API key not configured, skipping email notifications')
                    return
                }

                const mailgunDomain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
                const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${mailgunDomain}`
                const fromName = process.env.MAILGUN_FROM_NAME || 'Coco Reporting'

                const mailgun = new Mailgun(FormData)
                const mg = mailgun.client({
                    username: 'api',
                    key: mailgunApiKey,
                    url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net'
                })

                // 1. Notify admins about new user
                try {
                    const { data: adminUsers } = await supabaseAdmin
                        .from('users')
                        .select('email, display_name, role')
                        .in('role', ['admin', 'owner'])

                    const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
                    
                    // Always include these admin emails as fallback/ensure they're included
                    const requiredAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
                    const allAdminEmails = [...new Set([...adminEmails, ...requiredAdminEmails])] // Remove duplicates
                    
                    console.log('User creation notification - Admin emails:', {
                        fromDatabase: adminEmails,
                        totalRecipients: allAdminEmails,
                        adminUsersFound: adminUsers?.length || 0
                    })
                    
                    if (allAdminEmails.length > 0) {
                        const adminSubject = `New User Created - ${displayName}`
                        const adminHtml = `
                            <h2>New User Created</h2>
                            <p><strong>Name:</strong> ${displayName}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Role:</strong> ${role}</p>
                            <p><strong>Created by:</strong> ${currentUser.email}</p>
                            <p>The user has been automatically approved and can now log in.</p>
                        `

                        const adminData = await mg.messages.create(mailgunDomain, {
                            from: `${fromName} <${fromEmail}>`,
                            to: allAdminEmails,
                            subject: adminSubject,
                            html: adminHtml
                        })

                        console.log('Admin notification email sent successfully to:', allAdminEmails, 'Message ID:', adminData.id)
                    }
                } catch (adminEmailError) {
                    console.error('Error sending admin notification email:', adminEmailError)
                }

                // 2. Send welcome email to new user with password setup instructions
                try {
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

                    const welcomeData = await mg.messages.create(mailgunDomain, {
                        from: `${fromName} <${fromEmail}>`,
                        to: email,
                        subject: welcomeSubject,
                        html: welcomeHtml
                    })

                    console.log('Welcome email sent successfully:', welcomeData.id)
                } catch (welcomeEmailError) {
                    console.error('Error sending welcome email:', welcomeEmailError)
                }
            } catch (emailError) {
                console.error('Error in email notification process:', emailError)
                // Don't fail user creation if email fails
            }
        }).catch((err: unknown) => {
            console.error('Unhandled error in email notification:', err)
        })

        // Return success response immediately (emails will be sent in background)
        return successResponse

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
