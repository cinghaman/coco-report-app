'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import CashReportForm from '@/components/cash-report/CashReportForm'

export default function NewCashReportPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }
      const { data: userProfile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()
      if (error || !userProfile) {
        router.replace('/login')
        return
      }
      if (userProfile.role !== 'admin' && userProfile.role !== 'owner') {
        router.replace('/dashboard')
        return
      }
      setProfile(userProfile)
      setLoading(false)
    })()
  }, [router])

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={profile} />
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New cash report</h1>
          <p className="mt-1 text-sm text-gray-500">
            Coco Lounge — record cash movements with optional document numbers and descriptions.
          </p>
        </div>
        <CashReportForm user={profile} />
      </main>
    </div>
  )
}
