'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User, CashReportLine } from '@/lib/supabase'
import { closingCash, fetchOpeningCashForNewReport, resolveCocoLoungeVenueId } from '@/lib/cash-report'

export type LineDraft = {
  id: string
  document_number: string
  details: string
  income: number
  expense: number
}

interface CashReportFormProps {
  user: User
  reportId?: string
}

function newLine(): LineDraft {
  return {
    id: crypto.randomUUID(),
    document_number: '',
    details: '',
    income: 0,
    expense: 0,
  }
}

const formatMoney = (n: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(n)

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default function CashReportForm({ user, reportId }: CashReportFormProps) {
  const router = useRouter()
  const isEdit = Boolean(reportId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [venueId, setVenueId] = useState<string | null>(null)
  const [forDate, setForDate] = useState(() => new Date().toISOString().split('T')[0])
  const [cashFromPrevious, setCashFromPrevious] = useState(0)
  const [lines, setLines] = useState<LineDraft[]>([newLine()])

  const loadReport = useCallback(async () => {
    if (!supabase || !reportId) return
    setLoading(true)
    setError(null)
    try {
      const { data: report, error: re } = await supabase
        .from('cash_reports')
        .select('*')
        .eq('id', reportId)
        .single()
      if (re) throw re
      if (!report) throw new Error('Report not found')

      setVenueId(report.venue_id)
      setForDate(report.for_date)
      setCashFromPrevious(Number(report.cash_from_previous_day) || 0)

      const { data: lineRows, error: le } = await supabase
        .from('cash_report_lines')
        .select('*')
        .eq('cash_report_id', reportId)
        .order('sort_order', { ascending: true })

      if (le) throw le

      if (lineRows?.length) {
        setLines(
          lineRows.map((l: CashReportLine) => ({
            id: l.id,
            document_number: l.document_number ?? '',
            details: l.details ?? '',
            income: Number(l.income) || 0,
            expense: Number(l.expense) || 0,
          }))
        )
      } else {
        setLines([newLine()])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [reportId])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setError('Supabase client is not available')
      return
    }
    ;(async () => {
      try {
        if (reportId) {
          await loadReport()
        } else {
          const id = await resolveCocoLoungeVenueId(supabase)
          if (!id) {
            setError(
              'No active venue found for Coco Lounge. Check venues (slug coco-lounge or name).'
            )
            setLoading(false)
            return
          }
          setVenueId(id)
          setLoading(false)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to initialize')
        setLoading(false)
      }
    })()
  }, [reportId, loadReport])

  useEffect(() => {
    if (!supabase || isEdit || !venueId || !forDate) return
    let cancelled = false
    ;(async () => {
      try {
        const opening = await fetchOpeningCashForNewReport(supabase, venueId, forDate)
        if (!cancelled) setCashFromPrevious(opening)
      } catch (err: unknown) {
        if (!cancelled) {
          console.error(err)
          setError(err instanceof Error ? err.message : 'Could not load opening cash')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, isEdit, venueId, forDate])

  const closing = useMemo(
    () => closingCash(cashFromPrevious, lines),
    [cashFromPrevious, lines]
  )

  const updateLine = (id: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }

  const addRow = () => {
    setLines((prev) => [...prev, newLine()])
  }

  const removeRow = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)))
  }

  const handleSave = async () => {
    if (!supabase) return
    if (!venueId || !forDate) {
      setError(!venueId ? 'Venue could not be resolved' : 'Select a date')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        venue_id: venueId,
        for_date: forDate,
        cash_from_previous_day: cashFromPrevious,
        updated_at: new Date().toISOString(),
      }

      let savedId: string

      if (isEdit && reportId) {
        const { error: ue } = await supabase
          .from('cash_reports')
          .update(payload)
          .eq('id', reportId)
        if (ue) throw ue

        const { error: de } = await supabase
          .from('cash_report_lines')
          .delete()
          .eq('cash_report_id', reportId)
        if (de) throw de

        const inserts = lines.map((l, i) => ({
          cash_report_id: reportId,
          sort_order: i,
          document_number: l.document_number.trim() || null,
          details: l.details.trim() || null,
          income: Number(l.income) || 0,
          expense: Number(l.expense) || 0,
        }))
        const { error: ie } = await supabase.from('cash_report_lines').insert(inserts)
        if (ie) throw ie
        savedId = reportId
      } else {
        const { data: created, error: ce } = await supabase
          .from('cash_reports')
          .insert({
            ...payload,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (ce) throw ce
        if (!created?.id) throw new Error('No report id returned')

        const inserts = lines.map((l, i) => ({
          cash_report_id: created.id,
          sort_order: i,
          document_number: l.document_number.trim() || null,
          details: l.details.trim() || null,
          income: Number(l.income) || 0,
          expense: Number(l.expense) || 0,
        }))
        const { error: ie } = await supabase.from('cash_report_lines').insert(inserts)
        if (ie) throw ie
        savedId = created.id
      }

      // Notify admins / owners (same distribution as EOD reports)
      try {
        const { data: adminUsers, error: adminError } = await supabase
          .from('users')
          .select('email, display_name, role')
          .in('role', ['admin', 'owner'])

        if (adminError) {
          console.error('Cash report email: error fetching admin emails:', adminError)
        }

        const adminEmails = adminUsers?.map((u) => u.email).filter(Boolean) || []
        const requiredAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
        const recipientEmails = [...new Set([...adminEmails, ...requiredAdminEmails])]
        const to =
          recipientEmails.length > 0 ? recipientEmails : requiredAdminEmails

        const action = isEdit ? 'Updated' : 'Created'
        const subject = `Cash Report ${action} - Coco Lounge - ${forDate}`
        const closing = closingCash(cashFromPrevious, lines)

        const rowsHtml = lines
          .map(
            (l, i) =>
              `<tr>
                <td style="padding:8px;border:1px solid #ddd;">${i + 1}</td>
                <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(l.document_number || '—')}</td>
                <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(l.details || '—')}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatMoney(Number(l.income) || 0)}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:right;">${formatMoney(Number(l.expense) || 0)}</td>
              </tr>`
          )
          .join('')

        const html = `
          <h2>Cash Report ${action}</h2>
          <p><strong>Venue:</strong> Coco Lounge</p>
          <p><strong>Date:</strong> ${forDate}</p>
          <p><strong>${action} by:</strong> ${escapeHtml(user.display_name || user.email)}</p>
          <p><strong>Cash from previous day:</strong> ${formatMoney(cashFromPrevious)}</p>

          <h3>Line items</h3>
          <table style="border-collapse:collapse;width:100%;max-width:720px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">#</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Document no.</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Details</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Income</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Expense</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <p style="margin-top:16px;"><strong>Closing cash:</strong> ${formatMoney(closing)}</p>
          <p style="font-size:13px;color:#374151;">Opening cash plus total income minus total expenses from the line items.</p>

          <p style="margin-top:16px;font-size:14px;">
            <a href="https://coco-report-app.vercel.app/cash-report/${savedId}" target="_blank">View cash report</a>
          </p>
        `

        const emailResponse = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, subject, html }),
        })
        const emailResult = await emailResponse.json()
        if (emailResponse.ok) {
          console.log('Cash report email:', emailResult.message)
        } else {
          console.error('Cash report email failed:', emailResult)
        }
      } catch (emailErr) {
        console.error('Cash report email error:', emailErr)
      }

      router.push('/cash-report')
      router.refresh()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Save failed (duplicate date for venue?)'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-600 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="bg-white shadow sm:rounded-lg border border-gray-200">
      <div className="px-4 py-5 sm:p-6 space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="max-w-md">
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-medium text-gray-800">Coco Lounge</span>
            <span className="text-gray-400"> · </span>
            cash only
          </p>
          <div>
            <label htmlFor="cr-date" className="block text-sm font-medium text-gray-700">
              Date *
            </label>
            <input
              id="cr-date"
              type="date"
              disabled={isEdit}
              value={forDate}
              onChange={(e) => setForDate(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-medium text-slate-800">Cash from previous day</div>
          <p className="mt-1 text-xs text-slate-600">
            Opening balance carried from the prior cash report (that report&apos;s opening cash
            plus all income minus all expenses).
          </p>
          <div className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
            {formatMoney(cashFromPrevious)}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900">Income &amp; expenses</h3>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            >
              Add row
            </button>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0 border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Doc. no.
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Details
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                    Income
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                    Expense
                  </th>
                  <th className="px-2 py-2 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="text"
                        value={line.document_number}
                        onChange={(e) =>
                          updateLine(line.id, { document_number: e.target.value })
                        }
                        className="block w-full min-w-[7rem] rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <textarea
                        value={line.details}
                        onChange={(e) => updateLine(line.id, { details: e.target.value })}
                        rows={2}
                        className="block w-full min-w-[10rem] rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                        placeholder="Description"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.income || ''}
                        onChange={(e) =>
                          updateLine(line.id, {
                            income: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-right text-gray-900 tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 align-top">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.expense || ''}
                        onChange={(e) =>
                          updateLine(line.id, {
                            expense: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-right text-gray-900 tabular-nums"
                      />
                    </td>
                    <td className="px-1 py-2 align-top text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(line.id)}
                        disabled={lines.length <= 1}
                        className="text-red-600 hover:text-red-800 disabled:opacity-30 text-sm"
                        title="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-emerald-900">Closing cash</div>
            <p className="text-xs text-emerald-800 mt-1">
              After the line items above: opening cash, plus all income minus all expenses in this
              table.
            </p>
          </div>
          <div className="text-xl font-bold text-emerald-900 tabular-nums shrink-0">
            {formatMoney(closing)}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/cash-report')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save report'}
          </button>
        </div>
      </div>
    </div>
  )
}
