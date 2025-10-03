import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabase } from './supabase'
import type { User, UserRole } from './supabase'

// Server-side Supabase client
export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

// Get current user with profile
export const getCurrentUser = async (): Promise<{ user: unknown; profile: User | null }> => {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return { user: null, profile: null }
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('Error fetching user profile:', profileError)
    return { user, profile: null }
  }

  return { user, profile }
}

// Check if user has required role
export const hasRole = (userRole: UserRole, requiredRole: UserRole): boolean => {
  const roleHierarchy: Record<UserRole, number> = {
    staff: 1,
    admin: 2,
    owner: 3
  }
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

// Check if user can access venue
export const canAccessVenue = (user: User, venueId: string): boolean => {
  if (hasRole(user.role, 'admin')) {
    return true // Admins can access all venues
  }
  
  return user.venue_ids.includes(venueId)
}

// Sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Error signing out:', error)
    throw error
  }
}
