'use client'

import { useEffect, useState, use } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import EODForm from '@/components/reports/EODForm'

interface ReportEditPageProps {
  params: Promise<{
    id: string
  }>
}

export default function ReportEditPage({ params }: ReportEditPageProps) {
  const resolvedParams = use(params)
  const [user, setUser] = useState<unknown>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<Record<string, unknown> | null>(null)

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

      // Fetch the report first
      const { data: reportData, error: reportError } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (reportError || !reportData) {
        console.error('Error fetching report:', reportError)
        window.location.href = '/dashboard'
        return
      }

      // Check if user can edit this report
      const canEdit = userProfile.role === 'admin' || 
                     (reportData.created_by === session.user.id && reportData.status === 'draft')
      
      if (!canEdit) {
        window.location.href = '/dashboard'
        return
      }

      setReport(reportData)
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

  if (!user || !profile || !report) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={profile} />
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="md:flex md:items-center md:justify-between mb-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                Edit Report - {report?.for_date ? new Date(report.for_date as string).toLocaleDateString('pl-PL') : 'Loading...'}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Edit the daily report details
              </p>
            </div>
          </div>
          
          <EODForm user={profile} initialData={report} />
        </div>
      </main>
    </div>
  )
}
