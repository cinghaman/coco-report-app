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
  flavor: number
  cash_deposits: number
  drawer: number
  przelew: number
  glovo: number
  uber: number
  wolt: number
  pyszne: number
  bolt: number
  total_sale_with_special_payment: number
  // Expenditure
  withdrawal: number
  locker_withdrawal: number
  deposit: number
  staff_cost: number
  service_10_percent: number
  // Management Info
  staff_spent: number
  // Revenue fields
  gross_revenue: number
  net_revenue: number
  // Carryover & derived snapshots
  cash_previous_day: number
  calculated_cash_expected: number
  reconciliation_diff: number
}

export default function EODForm({ user, initialData }: EODFormProps) {
  const router = useRouter()
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cashPreviousDay, setCashPreviousDay] = useState<number>(0)
  const [drawerPreviousDay, setDrawerPreviousDay] = useState<number>(0)
  const [reportId] = useState<string | null>(initialData?.id as string || null)
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({})
  const [withdrawals, setWithdrawals] = useState<Array<{ id: string, amount: number, reason: string }>>([{ id: '1', amount: 0, reason: '' }])
  const [representacja1, setRepresentacja1] = useState<Array<{ id: string, amount: number, reason: string }>>([{ id: '1', amount: 0, reason: '' }])
  const [serviceKwotowy, setServiceKwotowy] = useState<Array<{ id: string, amount: number, reason: string }>>([{ id: '1', amount: 0, reason: '' }])
  const [strata, setStrata] = useState<Array<{ id: string, amount: number, reason: string }>>([{ id: '1', amount: 0, reason: '' }])

  const [formData, setFormData] = useState<FormData>({
    venue_id: (initialData?.venue_id as string) || '',
    for_date: (initialData?.for_date as string) || new Date().toISOString().split('T')[0],
    total_sale_gross: (initialData?.total_sale_gross as number) || 0,
    card_1: (initialData?.card_1 as number) || 0,
    card_2: (initialData?.card_2 as number) || 0,
    cash: (initialData?.cash as number) || 0,
    flavor: (initialData?.flavor as number) || 0,
    cash_deposits: (initialData?.cash_deposits as number) || 0,
    drawer: (initialData?.drawer as number) || 0,
    przelew: (initialData?.przelew as number) || 0,
    glovo: (initialData?.glovo as number) || 0,
    uber: (initialData?.uber as number) || 0,
    wolt: (initialData?.wolt as number) || 0,
    pyszne: (initialData?.pyszne as number) || 0,
    bolt: (initialData?.bolt as number) || 0,
    total_sale_with_special_payment: (initialData?.total_sale_with_special_payment as number) || 0,
    withdrawal: (initialData?.withdrawal as number) || 0,
    locker_withdrawal: (initialData?.locker_withdrawal as number) || 0,
    deposit: (initialData?.deposit as number) || 0,
    staff_cost: (initialData?.staff_cost as number) || 0,
    service_10_percent: (initialData?.service_10_percent as number) || 0,
    staff_spent: (initialData?.staff_spent as number) || 0,
    gross_revenue: (initialData?.gross_revenue as number) || 0,
    net_revenue: (initialData?.net_revenue as number) || 0,
    // Carryover & derived snapshots
    cash_previous_day: (initialData?.cash_previous_day as number) || 0,
    calculated_cash_expected: (initialData?.calculated_cash_expected as number) || 0,
    reconciliation_diff: (initialData?.reconciliation_diff as number) || 0
  })

  useEffect(() => {
    fetchVenues()
    if (initialData) {
      fetchWithdrawals()
      fetchRepresentacja1()
      fetchServiceKwotowy()
      fetchStrata()
    }
  }, [initialData])

  // Initialize displayValues with initialData when editing
  useEffect(() => {
    if (initialData) {
      const initialDisplayValues: Record<string, string> = {}

      // Initialize display values for all number fields
      const numberFields = [
        'total_sale_gross', 'card_1', 'card_2', 'cash', 'flavor', 'cash_deposits', 'drawer',
        'przelew', 'glovo', 'uber', 'wolt', 'pyszne', 'bolt', 'total_sale_with_special_payment',
        'withdrawal', 'locker_withdrawal', 'deposit', 'staff_cost', 'service_10_percent', 'staff_spent',
        'gross_revenue', 'net_revenue', 'cash_previous_day', 'calculated_cash_expected', 'reconciliation_diff'
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

  const fetchPreviousDayDrawer = async () => {
    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      const { data, error } = await supabase.rpc('fn_prev_day_total_cash', {
        p_venue: formData.venue_id,
        p_date: formData.for_date
      })

      if (error) throw error
      const drawerValue = data || 0
      setDrawerPreviousDay(drawerValue)

      // Only auto-populate the drawer field for non-admin users
      // Admin users can edit this field manually
      if (user.role !== 'admin') {
        setFormData(prev => ({ ...prev, drawer: drawerValue }))
        setDisplayValues(prev => ({ ...prev, drawer: drawerValue.toString() }))
      }
    } catch (error) {
      console.error('Error fetching previous day drawer:', error)
      setDrawerPreviousDay(0)
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
        setWithdrawals([{ id: '1', amount: 0, reason: '' }])
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error)
      // Keep default withdrawal on error
      setWithdrawals([{ id: '1', amount: 0, reason: '' }])
    }
  }

  const fetchRepresentacja1 = async () => {
    if (!initialData?.id) return

    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      const { data, error } = await supabase
        .from('report_representacja_1')
        .select('*')
        .eq('report_id', initialData.id)
        .order('created_at')

      if (error) throw error

      if (data && data.length > 0) {
        const representacja1Data = data.map(r => ({
          id: r.id,
          amount: r.amount,
          reason: r.reason || ''
        }))
        setRepresentacja1(representacja1Data)
      } else {
        setRepresentacja1([{ id: '1', amount: 0, reason: '' }])
      }
    } catch (error) {
      console.error('Error fetching representacja1:', error)
      setRepresentacja1([{ id: '1', amount: 0, reason: '' }])
    }
  }

  const fetchServiceKwotowy = async () => {
    if (!initialData?.id) return

    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      const { data, error } = await supabase
        .from('report_service_kwotowy')
        .select('*')
        .eq('report_id', initialData.id)
        .order('created_at')

      if (error) throw error

      if (data && data.length > 0) {
        const serviceKwotowyData = data.map(s => ({
          id: s.id,
          amount: s.amount,
          reason: s.reason || ''
        }))
        setServiceKwotowy(serviceKwotowyData)
      } else {
        setServiceKwotowy([{ id: '1', amount: 0, reason: '' }])
      }
    } catch (error) {
      console.error('Error fetching service kwotowy:', error)
      setServiceKwotowy([{ id: '1', amount: 0, reason: '' }])
    }
  }

  const fetchStrata = async () => {
    if (!initialData?.id) return

    try {
      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      const { data, error } = await supabase
        .from('report_strata')
        .select('*')
        .eq('report_id', initialData.id)
        .order('created_at')

      if (error) throw error

      if (data && data.length > 0) {
        const strataData = data.map(s => ({
          id: s.id,
          amount: s.amount,
          reason: s.reason || ''
        }))
        setStrata(strataData)
      } else {
        setStrata([{ id: '1', amount: 0, reason: '' }])
      }
    } catch (error) {
      console.error('Error fetching strata:', error)
      setStrata([{ id: '1', amount: 0, reason: '' }])
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
    setWithdrawals(prev => [...prev, { id: newId, amount: 0, reason: '' }])
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

  const addRepresentacja1 = () => {
    const newId = Date.now().toString()
    setRepresentacja1(prev => [...prev, { id: newId, amount: 0, reason: '' }])
  }

  const removeRepresentacja1 = (id: string) => {
    if (representacja1.length > 1) {
      setRepresentacja1(prev => prev.filter(r => r.id !== id))
    }
  }

  const updateRepresentacja1 = (id: string, field: 'amount' | 'reason', value: string | number) => {
    setRepresentacja1(prev => prev.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ))
  }

  const getTotalRepresentacja1 = () => {
    return representacja1.reduce((sum, r) => sum + r.amount, 0)
  }

  const addServiceKwotowy = () => {
    const newId = Date.now().toString()
    setServiceKwotowy(prev => [...prev, { id: newId, amount: 0, reason: '' }])
  }

  const removeServiceKwotowy = (id: string) => {
    if (serviceKwotowy.length > 1) {
      setServiceKwotowy(prev => prev.filter(s => s.id !== id))
    }
  }

  const updateServiceKwotowy = (id: string, field: 'amount' | 'reason', value: string | number) => {
    setServiceKwotowy(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ))
  }

  const getTotalServiceKwotowy = () => {
    return serviceKwotowy.reduce((sum, s) => sum + s.amount, 0)
  }

  const addStrata = () => {
    const newId = Date.now().toString()
    setStrata(prev => [...prev, { id: newId, amount: 0, reason: '' }])
  }

  const removeStrata = (id: string) => {
    if (strata.length > 1) {
      setStrata(prev => prev.filter(s => s.id !== id))
    }
  }

  const updateStrata = (id: string, field: 'amount' | 'reason', value: string | number) => {
    setStrata(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    ))
  }

  const getTotalStrata = () => {
    return strata.reduce((sum, s) => sum + s.amount, 0)
  }

  useEffect(() => {
    if (formData.venue_id && formData.for_date) {
      fetchPreviousDayCash()
      fetchPreviousDayDrawer()
    }
  }, [formData.venue_id, formData.for_date])

  // Update formData withdrawal when withdrawals change
  useEffect(() => {
    setFormData(prev => ({ ...prev, withdrawal: getTotalWithdrawals() }))
  }, [withdrawals])

  // Auto-calculate total_sale_gross (excluding Representacja 1, drawer cost; including cash_deposits)
  useEffect(() => {
    const calculatedTotal = formData.card_1 + formData.card_2 + formData.cash +
      formData.flavor + formData.cash_deposits +
      formData.przelew + formData.glovo + formData.uber +
      formData.wolt + formData.pyszne + formData.bolt +
      formData.total_sale_with_special_payment
    setFormData(prev => ({ ...prev, total_sale_gross: calculatedTotal }))
  }, [formData.card_1, formData.card_2, formData.cash, formData.flavor, formData.cash_deposits,
  formData.przelew, formData.glovo, formData.uber, formData.wolt, formData.pyszne,
  formData.bolt, formData.total_sale_with_special_payment])

  // Auto-calculate gross revenue
  useEffect(() => {
    const totalCardPayment = formData.card_1 + formData.card_2
    const totalIncomeFromDelivery = (formData.przelew + formData.glovo + formData.uber + formData.wolt + formData.pyszne + formData.bolt) * 0.70
    const grossRevenue = totalCardPayment + totalIncomeFromDelivery + formData.total_sale_with_special_payment + formData.cash + formData.flavor + formData.cash_deposits
    setFormData(prev => ({ ...prev, gross_revenue: grossRevenue }))
  }, [formData.card_1, formData.card_2, formData.przelew, formData.glovo, formData.uber, formData.wolt, formData.pyszne, formData.bolt, formData.total_sale_with_special_payment, formData.cash, formData.flavor, formData.cash_deposits])

  // Auto-calculate net revenue
  useEffect(() => {
    const totalService = (getTotalServiceKwotowy() + formData.service_10_percent) * 0.90
    const netRevenue = formData.gross_revenue - getTotalWithdrawals() - totalService
    setFormData(prev => ({ ...prev, net_revenue: netRevenue }))
  }, [formData.gross_revenue, formData.service_10_percent, withdrawals, serviceKwotowy])

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
        gross_revenue: formData.gross_revenue,
        net_revenue: formData.net_revenue,
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

      // Send email notification if report is created or submitted (not for drafts)
      // Only send for submitted reports to avoid spam
      if (data.id && status === 'submitted') {
        try {
          const venue = venues.find(v => v.id === formData.venue_id)
          const venueName = venue?.name || 'Unknown Venue'

          // Fetch all admin emails
          const { data: adminUsers, error: adminError } = await supabase
            .from('users')
            .select('email, display_name, role')
            .in('role', ['admin', 'owner'])

          if (adminError) {
            console.error('Error fetching admin emails:', adminError)
          }

          const adminEmails = adminUsers?.map(u => u.email).filter(Boolean) || []
          
          // Always include these admin emails as fallback/ensure they're included
          const requiredAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
          const allAdminEmails = [...new Set([...adminEmails, ...requiredAdminEmails])] // Remove duplicates
          
          console.log('Report creation notification - Admin emails fetched:', {
            fromDatabase: adminEmails,
            totalRecipients: allAdminEmails,
            adminUsersFound: adminUsers?.length || 0,
            error: adminError?.message
          })

          const recipientEmails = allAdminEmails.length > 0 
            ? allAdminEmails 
            : requiredAdminEmails // Final fallback

          console.log('Preparing to send email notifications to:', recipientEmails)

          const action = initialData ? 'Updated' : 'Created'
          const subject = `EOD Report ${action} - ${venueName} - ${formData.for_date}`

          const fmt = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })
          const totalService = (getTotalServiceKwotowy() + formData.service_10_percent) * 0.90
          const totalCardPayment = formData.card_1 + formData.card_2
          const totalIncomeFromDelivery = (formData.przelew + formData.glovo + formData.uber + formData.wolt + formData.pyszne + formData.bolt) * 0.70
          const totalCash = formData.cash + formData.flavor + formData.cash_deposits + formData.total_sale_with_special_payment + formData.drawer - getTotalWithdrawals() - totalService

          const body = `
            <h2>EOD Report ${action}</h2>
            <p><strong>Venue:</strong> ${venueName}</p>
            <p><strong>Date:</strong> ${formData.for_date}</p>
            <p><strong>${initialData ? 'Updated' : 'Created'} by:</strong> ${user.display_name || user.email}</p>
            <p><strong>Status:</strong> Submitted</p>
            <p><strong>Total Sales (Gross):</strong> ${fmt(formData.total_sale_gross)}</p>
            <p style="font-size: 12px; color: #666; margin-top: -8px;">Card 1 + Card 2 + Cash + Flavor + Cash Deposits + Przelew + Glovo + Uber + Wolt + Pyszne + Bolt + Representacja 2 (excludes Drawer)</p>

            <h3>Mini Calculations</h3>
            <table style="border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Total Service</strong></td><td style="padding: 6px 0;">${fmt(totalService)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">(Service Kwotowy + Service 10%) × 0.90</td></tr>
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Total Card Payment</strong></td><td style="padding: 6px 0;">${fmt(totalCardPayment)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">Card 1 + Card 2</td></tr>
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Total Cash</strong></td><td style="padding: 6px 0;">${fmt(totalCash)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">Cash + Flavor + Cash Deposits + Representacja 2 + Drawer - Withdrawals - Total Service</td></tr>
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Total Income from Delivery Apps</strong></td><td style="padding: 6px 0;">${fmt(totalIncomeFromDelivery)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">(Przelew + Glovo + Uber + Wolt + Pyszne + Bolt) × 0.70</td></tr>
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Locker from Previous</strong></td><td style="padding: 6px 0;">${fmt(formData.drawer)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">Locker + Drawer from previous day</td></tr>
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Cash to Show</strong></td><td style="padding: 6px 0;">${fmt(totalCash)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">Cash + Flavor + Cash Deposits + Representacja 2 + Drawer - Withdrawals - Total Service</td></tr>
            </table>

            <h3>End of Day Sales</h3>
            <table style="border-collapse: collapse; margin-bottom: 16px;">
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Gross Revenue</strong></td><td style="padding: 6px 0;">${fmt(formData.gross_revenue)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">Total Card Payment + Total Income from Delivery + Representacja 2 + Cash + Flavor + Cash Deposits</td></tr>
              <tr><td style="padding: 6px 12px 6px 0;"><strong>Net Revenue</strong></td><td style="padding: 6px 0;">${fmt(formData.net_revenue)}</td></tr>
              <tr><td style="padding: 2px 12px 2px 0; font-size: 12px; color: #666;" colspan="2">Gross Revenue - Total Withdrawals - Total Service</td></tr>
            </table>

            <p style="font-size: 14px; color: #000;">
              <a href="https://coco-report-app.vercel.app/reports/${data.id}" target="_blank">View Report</a>
            </p>
            `

          // Use server-side API to send emails (avoids CORS issues)
          console.log('Sending email notifications to:', recipientEmails)
          
          try {
            const emailResponse = await fetch('/api/send-email', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                to: recipientEmails,
                subject: subject,
                html: body
              }),
            })

            const emailResult = await emailResponse.json()
            
            if (emailResponse.ok) {
              console.log('Email notifications:', emailResult.message)
              if (emailResult.results) {
                emailResult.results.forEach((r: any) => {
                  if (r.success) {
                    console.log(`✓ Email sent to ${r.recipient}`)
                  } else {
                    console.error(`✗ Failed to send to ${r.recipient}:`, r.error, r.status || '')
                  }
                })
              }
            } else {
              console.error('Failed to send email notifications:', emailResult)
            }
          } catch (emailError) {
            console.error('Error sending email notifications:', emailError)
            // Don't fail the save operation if email fails
          }

        } catch (emailError) {
          console.error('Failed to send email notification:', emailError)
          // Don't fail the entire save operation if email fails
        }
      }



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

        // Save representacja1 entries
        if (initialData) {
          await supabase
            .from('report_representacja_1')
            .delete()
            .eq('report_id', data.id)
        }

        const representacja1ToSave = representacja1.filter(r => r.amount > 0 || r.reason.trim())
        if (representacja1ToSave.length > 0) {
          const { error: representacja1Error } = await supabase
            .from('report_representacja_1')
            .insert(
              representacja1ToSave.map(r => ({
                report_id: data.id,
                amount: r.amount,
                reason: r.reason.trim() || null
              }))
            )

          if (representacja1Error) throw representacja1Error
        }

        // Save service_kwotowy entries
        if (initialData) {
          await supabase
            .from('report_service_kwotowy')
            .delete()
            .eq('report_id', data.id)
        }

        const serviceKwotowyToSave = serviceKwotowy.filter(s => s.amount > 0 || s.reason.trim())
        if (serviceKwotowyToSave.length > 0) {
          const { error: serviceKwotowyError } = await supabase
            .from('report_service_kwotowy')
            .insert(
              serviceKwotowyToSave.map(s => ({
                report_id: data.id,
                amount: s.amount,
                reason: s.reason.trim() || null
              }))
            )

          if (serviceKwotowyError) throw serviceKwotowyError
        }

        // Save strata entries
        if (initialData) {
          await supabase
            .from('report_strata')
            .delete()
            .eq('report_id', data.id)
        }

        const strataToSave = strata.filter(s => s.amount > 0 || s.reason.trim())
        if (strataToSave.length > 0) {
          const { error: strataError } = await supabase
            .from('report_strata')
            .insert(
              strataToSave.map(s => ({
                report_id: data.id,
                amount: s.amount,
                reason: s.reason.trim() || null
              }))
            )

          if (strataError) throw strataError
        }
      }

      if (initialData) {
        // For edits, redirect back to the report detail page
        router.push(`/reports/${initialData.id}`)
      } else {
        // For new reports, redirect to the report detail page
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

  const renderReadOnlyField = (field: keyof FormData, label: string) => {
    const displayValue = displayValues[field] || ''

    return (
      <div>
        <label htmlFor={field} className="block text-sm font-medium text-gray-700">
          {label}
        </label>
        <input
          type="text"
          id={field}
          value={displayValue}
          readOnly
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-900 cursor-not-allowed"
          placeholder="0.00"
        />
      </div>
    )
  }

  const renderAdminEditableField = (field: keyof FormData, label: string) => {
    const isAdmin = user.role === 'admin'
    const displayValue = displayValues[field] || ''

    if (isAdmin) {
      return (
        <div>
          <label htmlFor={field} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          <input
            type="text"
            id={field}
            value={displayValue}
            onChange={(e) => handleNumberInputChange(field, e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
            placeholder="0.00"
          />
        </div>
      )
    } else {
      return renderReadOnlyField(field, label)
    }
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

            {/* Auto-calculated Total Sales Display */}
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-emerald-800">Total Sales (Gross) - Auto Calculated:</span>
                <span className="text-2xl font-bold text-emerald-900">{formatCurrency(formData.total_sale_gross)}</span>
              </div>
              <p className="text-xs text-emerald-700 mt-1">Card 1 + Card 2 + Cash + Flavor + Cash Deposits + Przelew + Glovo + Uber + Wolt + Pyszne + Bolt + Representacja 2 (excludes Drawer)</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {renderNumberInput('card_1', 'Card 1')}
              {renderNumberInput('card_2', 'Card 2')}
              {renderNumberInput('cash', 'Cash')}
              {renderNumberInput('flavor', 'Flavor')}
              {renderNumberInput('cash_deposits', 'Cash Deposits')}
              {renderAdminEditableField('drawer', 'Locker + Drawer Previous')}
              {renderNumberInput('przelew', 'Przelew')}
              {renderNumberInput('glovo', 'Glovo')}
              {renderNumberInput('uber', 'Uber')}
              {renderNumberInput('wolt', 'Wolt')}
              {renderNumberInput('pyszne', 'Pyszne')}
              {renderNumberInput('bolt', 'Bolt')}
              {renderNumberInput('total_sale_with_special_payment', 'Representacja 2')}
            </div>

          </div>

          {/* Expenditure Section (formerly Cash Management) */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Expenditure</h3>

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

            {/* Service (Kwotowy) - Multiple Entries */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-800">Service (Kwotowy)</h4>
                <button
                  type="button"
                  onClick={addServiceKwotowy}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Service
                </button>
              </div>

              <div className="space-y-4">
                {serviceKwotowy.map((service, index) => (
                  <div key={service.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Service {index + 1}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={displayValues[`service_kwotowy_${service.id}_amount`] || ''}
                            onChange={(e) => {
                              setDisplayValues(prev => ({ ...prev, [`service_kwotowy_${service.id}_amount`]: e.target.value }))
                              updateServiceKwotowy(service.id, 'amount', parseFloat(e.target.value) || 0)
                            }}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                            placeholder="Amount"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={service.reason}
                            onChange={(e) => updateServiceKwotowy(service.id, 'reason', e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                            placeholder="Reason"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {serviceKwotowy.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeServiceKwotowy(service.id)}
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

              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-800">Total Service (Kwotowy):</span>
                  <span className="text-lg font-bold text-purple-900">{formatCurrency(getTotalServiceKwotowy())}</span>
                </div>
              </div>
            </div>

            {/* Service (10%) - Single Field */}
            <div className="mb-6">
              {renderNumberInput('service_10_percent', 'Service (10%)')}
            </div>

            {/* Total Service (Kwotowy + Service 10%) */}
            <div className="mb-6">
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-800">Total Service (Kwotowy + Service 10%):</span>
                  <span className="text-lg font-bold text-purple-900">{formatCurrency(getTotalServiceKwotowy() + formData.service_10_percent)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Management Info Section (NEW) */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Management Info</h3>

            {/* Representacja 1 - Moved from Sales & Payments */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-800">Representacja 1</h4>
                <button
                  type="button"
                  onClick={addRepresentacja1}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Representacja 1
                </button>
              </div>

              <div className="space-y-4">
                {representacja1.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Representacja 1 #{index + 1}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={displayValues[`representacja1_${item.id}_amount`] || ''}
                            onChange={(e) => {
                              setDisplayValues(prev => ({ ...prev, [`representacja1_${item.id}_amount`]: e.target.value }))
                              updateRepresentacja1(item.id, 'amount', parseFloat(e.target.value) || 0)
                            }}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                            placeholder="Amount"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => updateRepresentacja1(item.id, 'reason', e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                            placeholder="Reason"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {representacja1.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRepresentacja1(item.id)}
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

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-800">Total Representacja 1:</span>
                  <span className="text-lg font-bold text-blue-900">{formatCurrency(getTotalRepresentacja1())}</span>
                </div>
              </div>
            </div>

            {/* Staff Spent - Single Field */}
            <div className="mb-6">
              {renderNumberInput('staff_spent', 'Staff Spent')}
            </div>

            {/* Strata - Multiple Entries */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-medium text-gray-800">Strata</h4>
                <button
                  type="button"
                  onClick={addStrata}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Strata
                </button>
              </div>

              <div className="space-y-4">
                {strata.map((item, index) => (
                  <div key={item.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Strata {index + 1}
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <input
                            type="text"
                            value={displayValues[`strata_${item.id}_amount`] || ''}
                            onChange={(e) => {
                              setDisplayValues(prev => ({ ...prev, [`strata_${item.id}_amount`]: e.target.value }))
                              updateStrata(item.id, 'amount', parseFloat(e.target.value) || 0)
                            }}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                            placeholder="Amount"
                          />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={item.reason}
                            onChange={(e) => updateStrata(item.id, 'reason', e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                            placeholder="Reason"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {strata.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStrata(item.id)}
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

              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-red-800">Total Strata:</span>
                  <span className="text-lg font-bold text-red-900">{formatCurrency(getTotalStrata())}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Mini Calculations Section (NEW) */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mini Calculations</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Total Service */}
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm font-medium text-purple-700 mb-1">Total Service</div>
                <div className="text-xl font-bold text-purple-900">
                  {formatCurrency((getTotalServiceKwotowy() + formData.service_10_percent) * 0.90)}
                </div>
                <div className="text-xs text-purple-600 mt-1">
                  (Service Kwotowy + Service 10%) × 0.90
                </div>
              </div>

              {/* Total Card Payment */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-700 mb-1">Total Card Payment</div>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(formData.card_1 + formData.card_2)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Card 1 + Card 2
                </div>
              </div>

              {/* Total Cash */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-700 mb-1">Total Cash</div>
                <div className="text-xl font-bold text-green-900">
                  {formatCurrency(
                    formData.cash + formData.flavor + formData.cash_deposits + formData.total_sale_with_special_payment + formData.drawer -
                    getTotalWithdrawals() - ((getTotalServiceKwotowy() + formData.service_10_percent) * 0.90)
                  )}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Cash + Flavor + Cash Deposits + Representacja 2 + Drawer - Withdrawals - Total Service
                </div>
              </div>

              {/* Total Income from Delivery Apps */}
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-sm font-medium text-orange-700 mb-1">Total Income from Delivery Apps</div>
                <div className="text-xl font-bold text-orange-900">
                  {formatCurrency(
                    (formData.przelew + formData.glovo + formData.uber + formData.wolt + formData.pyszne + formData.bolt) * 0.70
                  )}
                </div>
                <div className="text-xs text-orange-600 mt-1">
                  (Przelew + Glovo + Uber + Wolt + Pyszne + Bolt) × 0.70
                </div>
              </div>

              {/* Locker from Previous */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-sm font-medium text-slate-700 mb-1">Locker from Previous</div>
                <div className="text-xl font-bold text-slate-900">
                  {formatCurrency(formData.drawer)}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Locker + Drawer from previous day
                </div>
              </div>

              {/* Cash to Show */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="text-sm font-medium text-amber-700 mb-1">Cash to Show</div>
                <div className="text-xl font-bold text-amber-900">
                  {formatCurrency(
                    formData.cash + formData.flavor + formData.cash_deposits + formData.total_sale_with_special_payment + formData.drawer -
                    getTotalWithdrawals() - ((getTotalServiceKwotowy() + formData.service_10_percent) * 0.90)
                  )}
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  Cash + Flavor + Cash Deposits + Representacja 2 + Drawer - Withdrawals - Total Service
                </div>
              </div>
            </div>
          </div>

          {/* End of Day Sales Section */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">End of Day Sales</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Gross Revenue */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-700 mb-1">Gross Revenue</div>
                <div className="text-xl font-bold text-green-900">
                  {formatCurrency(formData.gross_revenue)}
                </div>
                <div className="text-xs text-green-600 mt-1">
                  Total Card Payment + Total Income from Delivery + Representacja 2 + Cash + Flavor + Cash Deposits
                </div>
              </div>

              {/* Net Revenue */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-700 mb-1">Net Revenue</div>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(formData.net_revenue)}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Gross Revenue - Total Withdrawals - Total Service
                </div>
              </div>
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
