'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import CashReportForm from '@/components/cash-report/CashReportForm'

export default function EditCashReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : null

  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      router.replace('/cash-report')
      return
    }
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
  }, [router, id])

  const handleDeleteReport = async () => {
    if (!id) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/cash-reports/${id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || 'Delete failed')
      setDeleteConfirm(false)
      router.replace('/cash-report')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
      setDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !profile || !id) {
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
        <div className="px-4 sm:px-0 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit cash report</h1>
            <p className="mt-1 text-sm text-gray-500">Update line items and save.</p>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {deleteError}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setDeleteConfirm(true)}
            className="inline-flex justify-center rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
          >
            Delete report
          </button>
        </div>
        <CashReportForm user={profile} reportId={id} />
      </main>

      {deleteConfirm && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
          onClick={() => !deleting && setDeleteConfirm(false)}
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
                  This removes this cash report and all its line items. This cannot be undone.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteReport}
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
