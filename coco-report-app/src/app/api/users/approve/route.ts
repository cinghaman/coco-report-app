import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/auth'

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
