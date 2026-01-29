import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { sendUserCreationEmails, getBaseUrl } from '@/lib/email-user-creation'

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

        // 3. Initialize Supabase admin client
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

        // 4. Check if user with this email already exists (from previous deletion or creation)
        // If exists, delete it first to allow recreation
        try {
            // Check in auth.users by email
            const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
            const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === email)
            
            if (existingAuthUser) {
                console.log('Found existing auth user with same email, deleting before recreation:', existingAuthUser.id)
                
                // Delete the existing auth user (this will cascade delete the profile via trigger)
                const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id)
                
                if (deleteAuthError && deleteAuthError.message !== 'User not found') {
                    console.warn('Error deleting existing auth user:', deleteAuthError)
                    // Continue anyway - try to create the user
                } else {
                    console.log('Successfully deleted existing auth user')
                    // Wait a moment for deletion to complete
                    await new Promise(resolve => setTimeout(resolve, 300))
                }
            }
            
            // Also check and clean up any orphaned profile (in case auth user was deleted but profile remains)
            const { data: existingProfile } = await supabaseAdmin
                .from('users')
                .select('id, email')
                .eq('email', email)
                .maybeSingle()
            
            if (existingProfile) {
                console.log('Found orphaned profile with same email, deleting:', existingProfile.id)
                await supabaseAdmin
                    .from('users')
                    .delete()
                    .eq('id', existingProfile.id)
            }
        } catch (cleanupError) {
            console.warn('Error during cleanup of existing user:', cleanupError)
            // Continue with user creation anyway
        }

        // 5. Create the user using the Service Role Key
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

        // 4. Upsert the user profile via RPC (trigger inserts first; upsert avoids duplicate key)
        if (newUser.user) {
            const validRoles = ['staff', 'admin', 'owner']
            const userRole = validRoles.includes(role) ? role : 'staff'

            await new Promise((r) => setTimeout(r, 500))

            const { error: profileError } = await supabaseAdmin.rpc('upsert_user_profile', {
                p_user_id: newUser.user.id,
                p_email: email,
                p_display_name: displayName,
                p_role: userRole,
                p_approved: true,
                p_approved_by: user.id,
                p_approved_at: new Date().toISOString(),
                p_venue_ids: venueIds,
            })

            if (profileError) {
                console.error('Error upserting user profile:', profileError)
                return NextResponse.json({
                    error: 'Database error creating user profile',
                    details: profileError.message,
                }, { status: 500 })
            }

            // Verify the profile
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

        const baseUrl = getBaseUrl(request)
        const { data: adminUsers } = await supabaseAdmin
            .from('users')
            .select('email')
            .in('role', ['admin', 'owner'])
        const adminEmails = adminUsers?.map((u) => u.email).filter(Boolean) ?? []

        console.log('[create user] Sending admin + welcome emails (admins=%d, newUser=%s)', adminEmails.length, email)
        const { adminSent, welcomeSent } = await sendUserCreationEmails({
            displayName,
            email,
            password,
            role,
            createdBy: currentUser.email,
            baseUrl,
            adminEmails,
        })
        if (adminSent && welcomeSent) {
            console.log('[create user] Admin and welcome emails sent successfully')
        } else {
            console.warn('[create user] Emails partially sent:', { adminSent, welcomeSent })
        }

        return NextResponse.json({
            user: newUser.user,
            message: 'User created successfully',
            displayName,
            venueIds,
        })

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
