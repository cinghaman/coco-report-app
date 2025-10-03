'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import ReportDetail from '@/components/reports/ReportDetail'

interface ReportDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ReportDetailPage({ params }: ReportDetailPageProps) {
  const resolvedParams = use(params)
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
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <ReportDetail reportId={resolvedParams.id} user={profile} />
        </div>
      </main>
    </div>
  )
}
