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
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean
    id: string | null
    dateLabel: string | null
  }>({ show: false, id: null, dateLabel: null })
  const [deleting, setDeleting] = useState(false)

  const allowed = (u: User) => u.role === 'admin' || u.role === 'owner'

  const formatRowDate = (forDate: string) =>
    new Date(forDate + 'T12:00:00').toLocaleDateString('pl-PL')

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

  const openDelete = (e: React.MouseEvent, id: string, forDate: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDeleteConfirm({ show: true, id, dateLabel: formatRowDate(forDate) })
  }

  const closeDelete = () => {
    if (!deleting) setDeleteConfirm({ show: false, id: null, dateLabel: null })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/cash-reports/${deleteConfirm.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Delete failed')
      await fetchList()
      setDeleteConfirm({ show: false, id: null, dateLabel: null })
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

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
                If tables are missing, create <code className="bg-amber-100 px-1 rounded">cash_reports</code> and{' '}
                <code className="bg-amber-100 px-1 rounded">cash_report_lines</code> with RLS in the Supabase SQL editor.
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
                <li key={r.id} className="flex items-stretch">
                  <Link
                    href={`/cash-report/${r.id}`}
                    className="block hover:bg-gray-50 flex-1 min-w-0 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-emerald-800">Coco Lounge</p>
                        <p className="text-sm text-gray-500">{formatRowDate(r.for_date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-500">Opening cash</p>
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">
                          {fmt(Number(r.cash_from_previous_day) || 0)}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => openDelete(e, r.id, r.for_date)}
                    className="flex-shrink-0 self-center p-2 mr-2 sm:mr-4 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete cash report"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>

      {deleteConfirm.show && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={closeDelete}
        >
          <div
            className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">Delete cash report</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 text-center">
                  Are you sure you want to delete this cash report for{' '}
                  <strong>{deleteConfirm.dateLabel}</strong>? This cannot be undone (all line items will
                  be removed).
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={closeDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
