'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import DashboardContent from '@/components/dashboard/DashboardContent'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<unknown>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simple auth check - just redirect if no user
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          router.push('/login')
          return
        }

        setUser(session.user)

        // Get user profile
        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        setProfile(userProfile)
      } catch (error) {
        console.error('Auth error:', error)
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  if (!user || !profile) {
    return null // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={profile} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <DashboardContent user={profile} />
      </main>
    </div>
  )
}
