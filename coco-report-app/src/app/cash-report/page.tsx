'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n)

type CashReportRow = {
  id: string
  for_date: string
  cash_from_previous_day: number
  created_at: string
}

export default function CashReportListPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CashReportRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const allowed = (u: User) => u.role === 'admin' || u.role === 'owner'

  const fetchList = useCallback(async () => {
    if (!supabase) return
    setLoadError(null)
    const { data, error } = await supabase
      .from('cash_reports')
      .select('id, for_date, cash_from_previous_day, created_at')
      .order('for_date', { ascending: false })
      .limit(100)
    if (error) {
      setLoadError(error.message)
      return
    }
    setRows((data as CashReportRow[]) ?? [])
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
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
        if (!allowed(userProfile)) {
          router.replace('/dashboard')
          return
        }
        setProfile(userProfile)
        await fetchList()
      } finally {
        setLoading(false)
      }
    })()
  }, [router, fetchList])

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
      <main className="max-w-5xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="md:flex md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cash Report</h1>
              <p className="mt-1 text-sm text-gray-500">
                Coco Lounge — cash income and expenses by document. Opening cash carries from the
                previous report.
              </p>
            </div>
            <Link
              href="/cash-report/new"
              className="inline-flex justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              New cash report
            </Link>
          </div>

          {loadError && (
            <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Could not load reports</p>
              <p className="mt-1">{loadError}</p>
              <p className="mt-2 text-xs text-amber-800">
                If tables are missing, run <code className="bg-amber-100 px-1 rounded">supabase/cash_reports.sql</code>{' '}
                in the Supabase SQL editor.
              </p>
            </div>
          )}

          <div className="bg-white shadow overflow-hidden sm:rounded-md border border-gray-200">
            <ul className="divide-y divide-gray-200">
              {rows.length === 0 && !loadError && (
                <li className="px-4 py-8 text-center text-gray-500 text-sm">
                  No cash reports yet. Create one to get started.
                </li>
              )}
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/cash-report/${r.id}`}
                    className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Coco Lounge</p>
                        <p className="text-sm text-gray-500">
                          {new Date(r.for_date + 'T12:00:00').toLocaleDateString('pl-PL')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Opening cash</p>
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">
                          {fmt(Number(r.cash_from_previous_day) || 0)}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  )
}
