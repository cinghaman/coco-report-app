'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import UserManagement from '@/components/admin/UserManagement'

export default function AdminPage() {
  const [user, setUser] = useState<unknown>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        console.log('No session found, redirecting to login')
        window.location.href = '/login'
        return
      }

      setUser(session.user)

      // Get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (profileError) {
        console.error('Error fetching user profile:', profileError)
        window.location.href = '/login'
        return
      }

      // Check if user is admin
      if (userProfile.role !== 'admin') {
        window.location.href = '/dashboard'
        return
      }

      setProfile(userProfile)
    } catch (error) {
      console.error('Auth check error:', error)
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!user || !profile) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={profile} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Admin Panel
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Manage users and system settings
              </p>
            </div>
          </div>
          
          <UserManagement user={profile} />
        </div>
      </main>
    </div>
  )
}
