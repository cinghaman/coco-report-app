'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User, Venue, DailyReport } from '@/lib/supabase'

interface EODFormProps {
  user: User
  initialData?: Record<string, unknown> // For editing existing reports
}

interface FormData {
  venue_id: string
  for_date: string
  // Core sales
  total_sale_gross: number
  card_1: number
  card_2: number
  cash: number
  przelew: number
  glovo: number
  uber: number
  wolt: number
  pyszne: number
  bolt: number
  total_sale_with_special_payment: number
  // Representation
  representation_note: string
  representation_amount: number
  strata_loss: number
  flavour: number
  // Cash management
  withdrawal: number
  locker_withdrawal: number
  deposit: number
  representacja: number
  staff_cost: number
  // Tips and cash
  tips_cash: number
  tips_card: number
  cash_in_envelope_after_tips: number
  left_in_drawer: number
  total_cash_in_locker: number
  // Services
  serwis: number
  serwis_k: number
  company: number
  voids: number
  // Notes
  notes: string
}

export default function EODForm({ user, initialData }: EODFormProps) {
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cashPreviousDay, setCashPreviousDay] = useState<number>(0)
  const [reportId] = useState<string | null>(initialData?.id as string || null)
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({})
  const [withdrawals, setWithdrawals] = useState<Array<{id: string, amount: number, reason: string}>>([{id: '1', amount: 0, reason: ''}])

  const [formData, setFormData] = useState<FormData>({
    venue_id: (initialData?.venue_id as string) || '',
    for_date: (initialData?.for_date as string) || new Date().toISOString().split('T')[0],
    total_sale_gross: (initialData?.total_sale_gross as number) || 0,
    card_1: (initialData?.card_1 as number) || 0,
    card_2: (initialData?.card_2 as number) || 0,
    cash: (initialData?.cash as number) || 0,
    przelew: (initialData?.przelew as number) || 0,
    glovo: (initialData?.glovo as number) || 0,
    uber: (initialData?.uber as number) || 0,
    wolt: (initialData?.wolt as number) || 0,
    pyszne: (initialData?.pyszne as number) || 0,
    bolt: (initialData?.bolt as number) || 0,
    total_sale_with_special_payment: (initialData?.total_sale_with_special_payment as number) || 0,
    representation_note: (initialData?.representation_note as string) || '',
    representation_amount: (initialData?.representation_amount as number) || 0,
    strata_loss: (initialData?.strata_loss as number) || 0,
    flavour: (initialData?.flavour as number) || 0,
    withdrawal: (initialData?.withdrawal as number) || 0,
    locker_withdrawal: (initialData?.locker_withdrawal as number) || 0,
    deposit: (initialData?.deposit as number) || 0,
    representacja: (initialData?.representacja as number) || 0,
    staff_cost: (initialData?.staff_cost as number) || 0,
    tips_cash: (initialData?.tips_cash as number) || 0,
    tips_card: (initialData?.tips_card as number) || 0,
    cash_in_envelope_after_tips: (initialData?.cash_in_envelope_after_tips as number) || 0,
    left_in_drawer: (initialData?.left_in_drawer as number) || 0,
    total_cash_in_locker: (initialData?.total_cash_in_locker as number) || 0,
    serwis: (initialData?.servis as number) || 0,
    serwis_k: (initialData?.servis_k as number) || 0,
    company: (initialData?.company as number) || 0,
    voids: (initialData?.voids as number) || 0,
    notes: (initialData?.notes as string) || ''
  })

  useEffect(() => {
    fetchVenues()
    if (initialData) {
      fetchWithdrawals()
    }
  }, [initialData])

  // Initialize displayValues with initialData when editing
  useEffect(() => {
    if (initialData) {
      const initialDisplayValues: Record<string, string> = {}
      
      // Initialize display values for all number fields
      const numberFields = [
        'total_sale_gross', 'card_1', 'card_2', 'cash', 'przelew', 'glovo', 'uber', 
        'wolt', 'pyszne', 'bolt', 'total_sale_with_special_payment', 'representation_amount',
        'strata_loss', 'flavour', 'withdrawal', 'locker_withdrawal', 'deposit', 
        'representacja', 'staff_cost', 'tips_cash', 'tips_card', 'cash_in_envelope_after_tips',
        'left_in_drawer', 'total_cash_in_locker', 'serwis', 'serwis_k', 'company', 'voids'
      ]
      
      numberFields.forEach(field => {
        const value = initialData[field]
        if (value !== undefined && value !== null) {
          initialDisplayValues[field] = value.toString()
        }
      })
      
      setDisplayValues(initialDisplayValues)
    }
  }, [initialData])

  const fetchVenues = async () => {
    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }
      
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error

      // Filter venues based on user access
      const accessibleVenues = data?.filter(venue => 
        user.role === 'admin' || user.venue_ids.includes(venue.id)
      ) || []

      setVenues(accessibleVenues)

      // Auto-select first venue if user has access to only one AND we're not editing
      if (accessibleVenues.length === 1 && !initialData) {
        setFormData(prev => ({ ...prev, venue_id: accessibleVenues[0].id }))
      }
    } catch (error) {
      console.error('Error fetching venues:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPreviousDayCash = async () => {
    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }
      
      const { data, error } = await supabase.rpc('fn_prev_day_cash', {
        p_venue: formData.venue_id,
        p_date: formData.for_date
      })

      if (error) throw error
      setCashPreviousDay(data || 0)
    } catch (error) {
      console.error('Error fetching previous day cash:', error)
      setCashPreviousDay(0)
    }
  }

  const fetchWithdrawals = async () => {
    if (!initialData?.id) return

    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }
      
      const { data, error } = await supabase
        .from('report_withdrawals')
        .select('*')
        .eq('report_id', initialData.id)
        .order('created_at')

      if (error) throw error

      if (data && data.length > 0) {
        const withdrawalsData = data.map(w => ({
          id: w.id,
          amount: w.amount,
          reason: w.reason || ''
        }))
        setWithdrawals(withdrawalsData)
      } else {
        // If no withdrawals found, keep the default empty withdrawal
        setWithdrawals([{id: '1', amount: 0, reason: ''}])
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
      // Keep default withdrawal on error
      setWithdrawals([{id: '1', amount: 0, reason: ''}])
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.venue_id) {
      newErrors.venue_id = 'Please select a venue'
    }

    if (!formData.for_date) {
      newErrors.for_date = 'Please select a date'
    }

    if (formData.total_sale_gross <= 0) {
      newErrors.total_sale_gross = 'Total sales must be greater than 0'
    }

    // Validate that payments sum equals total sales (with tolerance)
    const totalPayments = formData.card_1 + formData.card_2 + formData.cash + 
                         formData.przelew + formData.glovo + formData.uber + 
                         formData.wolt + formData.pyszne + formData.bolt + 
                         formData.total_sale_with_special_payment

    const difference = Math.abs(totalPayments - formData.total_sale_gross)
    if (difference > 0.50) {
      newErrors.payment_sum = `Payment sum (${totalPayments.toFixed(2)} PLN) doesn't match total sales (${formData.total_sale_gross.toFixed(2)} PLN). Difference: ${difference.toFixed(2)} PLN`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof FormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleNumberInputChange = (field: keyof FormData, value: string) => {
    // Store the raw display value
    setDisplayValues(prev => ({ ...prev, [field]: value }))
    
    // Handle empty input
    if (value.trim() === '' || value.trim() === '.') {
      setFormData(prev => ({ ...prev, [field]: 0 }))
      return
    }
    
    // Convert to number, allowing decimals
    const numericValue = parseFloat(value) || 0
    
    setFormData(prev => ({ ...prev, [field]: numericValue }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }


  const addWithdrawal = () => {
    const newId = Date.now().toString()
    setWithdrawals(prev => [...prev, {id: newId, amount: 0, reason: ''}])
  }

  const removeWithdrawal = (id: string) => {
    if (withdrawals.length > 1) {
      setWithdrawals(prev => prev.filter(w => w.id !== id))
    }
  }

  const updateWithdrawal = (id: string, field: 'amount' | 'reason', value: string | number) => {
    setWithdrawals(prev => prev.map(w => 
      w.id === id ? { ...w, [field]: value } : w
    ))
  }

  const getTotalWithdrawals = () => {
    return withdrawals.reduce((sum, w) => sum + w.amount, 0)
  }

  useEffect(() => {
    if (formData.venue_id && formData.for_date) {
      fetchPreviousDayCash()
    }
  }, [formData.venue_id, formData.for_date])

  // Update formData withdrawal when withdrawals change
  useEffect(() => {
    setFormData(prev => ({ ...prev, withdrawal: getTotalWithdrawals() }))
  }, [withdrawals])

  const handleSave = async (status: 'draft' | 'submitted') => {
    if (!validateForm()) return

    setSaving(true)
    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      const reportData: Partial<DailyReport> = {
        ...formData,
        status: status === 'submitted' ? 'approved' : status, // Auto-approve submitted reports
        cash_previous_day: cashPreviousDay,
      }

      let data, error

      if (initialData) {
        // Update existing report
        reportData.updated_at = new Date().toISOString()
        if (status === 'submitted') {
          reportData.approved_at = new Date().toISOString()
          reportData.approved_by = user.id
        }
        
        const result = await supabase
          .from('daily_reports')
          .update(reportData)
          .eq('id', initialData.id)
          .select()
          .single()
        
        data = result.data
        error = result.error
      } else {
        // Create new report
        reportData.created_by = user.id
        reportData.submitted_at = status === 'submitted' ? new Date().toISOString() : undefined
        reportData.approved_at = status === 'submitted' ? new Date().toISOString() : undefined
        reportData.approved_by = status === 'submitted' ? user.id : undefined

        const result = await supabase
          .from('daily_reports')
          .insert([reportData])
          .select()
          .single()
        
        data = result.data
        error = result.error
      }

      if (error) throw error

      // Save withdrawals to the new table
      if (data.id) {
        // First, delete existing withdrawals for this report (for updates)
        if (initialData) {
          await supabase
            .from('report_withdrawals')
            .delete()
            .eq('report_id', data.id)
        }

        // Insert new withdrawals
        const withdrawalsToSave = withdrawals.filter(w => w.amount > 0 || w.reason.trim())
        if (withdrawalsToSave.length > 0) {
          const { error: withdrawalsError } = await supabase
            .from('report_withdrawals')
            .insert(
              withdrawalsToSave.map(w => ({
                report_id: data.id,
                amount: w.amount,
                reason: w.reason.trim() || null
              }))
            )

          if (withdrawalsError) throw withdrawalsError
        }
      }

      if (initialData) {
        // For edits, redirect back to the report detail page
        router.push(`/reports/${initialData.id}`)
      } else {
        // For new reports, set the report ID and redirect
        setReportId(data.id)
        router.push(`/reports/${data.id}`)
      }
    } catch (error) {
      console.error('Error saving report:', error)
      setErrors({ submit: 'Failed to save report. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN'
    }).format(amount)
  }

  const renderNumberInput = (field: keyof FormData, label: string, required = false) => {
    const displayValue = displayValues[field] || ''
    
    return (
      <div>
        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
          {label} {required && '*'}
        </label>
        <input
          type="text"
          id={field}
          value={displayValue}
          onChange={(e) => handleNumberInputChange(field, e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
          placeholder="0.00"
        />
        {errors[field] && (
          <p className="mt-1 text-sm text-red-600">{errors[field]}</p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <form className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="venue_id" className="block text-sm font-medium text-gray-700">
                Venue *
              </label>
              <select
                id="venue_id"
                value={formData.venue_id}
                onChange={(e) => handleInputChange('venue_id', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
              >
                <option value="">Select a venue</option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </select>
              {errors.venue_id && (
                <p className="mt-1 text-sm text-red-600">{errors.venue_id}</p>
              )}
            </div>

            <div>
              <label htmlFor="for_date" className="block text-sm font-medium text-gray-700">
                Date *
              </label>
              <input
                type="date"
                id="for_date"
                value={formData.for_date}
                onChange={(e) => handleInputChange('for_date', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
              />
              {errors.for_date && (
                <p className="mt-1 text-sm text-red-600">{errors.for_date}</p>
              )}
            </div>
          </div>

          {/* Previous Day Cash Info */}
          {cashPreviousDay > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    Previous day cash available: <span className="font-medium">{formatCurrency(cashPreviousDay)}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sales Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Sales & Payments</h3>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {renderNumberInput('total_sale_gross', 'Total Sales (Gross)', true)}
              {renderNumberInput('card_1', 'Card 1')}
              {renderNumberInput('card_2', 'Card 2')}
              {renderNumberInput('cash', 'Cash')}
              {renderNumberInput('przelew', 'Przelew')}
              {renderNumberInput('glovo', 'Glovo')}
              {renderNumberInput('uber', 'Uber')}
              {renderNumberInput('wolt', 'Wolt')}
              {renderNumberInput('pyszne', 'Pyszne')}
              {renderNumberInput('bolt', 'Bolt')}
              {renderNumberInput('total_sale_with_special_payment', 'Special Payment')}
            </div>

            {errors.payment_sum && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{errors.payment_sum}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

            {/* Cash Management Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Cash Management</h3>
              
              {/* Dynamic Withdrawals */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-800">Withdrawals</h4>
                  <button
                    type="button"
                    onClick={addWithdrawal}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Withdrawal
                  </button>
                </div>
                
                <div className="space-y-4">
                  {withdrawals.map((withdrawal, index) => (
                    <div key={withdrawal.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Withdrawal {index + 1}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <input
                              type="text"
                              value={displayValues[`withdrawal_${withdrawal.id}_amount`] || ''}
                              onChange={(e) => {
                                setDisplayValues(prev => ({ ...prev, [`withdrawal_${withdrawal.id}_amount`]: e.target.value }))
                                updateWithdrawal(withdrawal.id, 'amount', parseFloat(e.target.value) || 0)
                              }}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              value={withdrawal.reason}
                              onChange={(e) => updateWithdrawal(withdrawal.id, 'reason', e.target.value)}
                              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                              placeholder="Reason for withdrawal"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        {withdrawals.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWithdrawal(withdrawal.id)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Total Withdrawals Display */}
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-emerald-800">Total Withdrawals:</span>
                    <span className="text-lg font-bold text-emerald-900">{formatCurrency(getTotalWithdrawals())}</span>
                  </div>
                </div>
              </div>
              
              {/* Other Cash Management Fields */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {renderNumberInput('locker_withdrawal', 'Locker Withdrawal')}
                {renderNumberInput('deposit', 'Deposit')}
                {renderNumberInput('representacja', 'Representacja')}
                {renderNumberInput('staff_cost', 'Staff Cost')}
              </div>
            </div>

          {/* Tips Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Tips & Cash Handling</h3>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {renderNumberInput('tips_cash', 'Tips (Cash)')}
              {renderNumberInput('tips_card', 'Tips (Card)')}
              {renderNumberInput('cash_in_envelope_after_tips', 'Cash in Envelope (After Tips)')}
              {renderNumberInput('left_in_drawer', 'Left in Drawer')}
              {renderNumberInput('total_cash_in_locker', 'Total Cash in Locker')}
            </div>
          </div>

          {/* Services Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Services & Other</h3>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {renderNumberInput('serwis', 'Serwis')}
              {renderNumberInput('serwis_k', 'Serwis K')}
              {renderNumberInput('company', 'Company')}
              {renderNumberInput('voids', 'Voids')}
              {renderNumberInput('strata_loss', 'Strata/Loss')}
              {renderNumberInput('flavour', 'Flavour')}
            </div>
          </div>

          {/* Representation Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Representation</h3>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {renderNumberInput('representation_amount', 'Representation Amount')}
              
              <div>
                <label htmlFor="representation_note" className="block text-sm font-medium text-gray-700">
                  Representation Note
                </label>
                <input
                  type="text"
                  id="representation_note"
                  value={formData.representation_note}
                  onChange={(e) => handleInputChange('representation_note', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                  placeholder="Optional note about representation"
                />
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="border-t border-gray-200 pt-6">
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                placeholder="Additional notes or comments..."
              />
            </div>
          </div>


          {/* Error Display */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSave('submitted')}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
