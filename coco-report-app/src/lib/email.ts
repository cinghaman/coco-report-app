interface EmailData {
  to: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail({ to, subject, text, html }: EmailData) {
  const mailgunApiKey = process.env.MAILGUN_API_KEY
  const mailgunDomain = process.env.MAILGUN_DOMAIN
  const mailgunBaseUrl = process.env.MAILGUN_BASE_URL || 'https://api.eu.mailgun.net'

  if (!mailgunApiKey || !mailgunDomain) {
    throw new Error('Mailgun configuration missing. Please set MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables.')
  }

  const formData = new FormData()
  formData.append('from', `Coco Reporting <noreply@${mailgunDomain}>`)
  formData.append('to', to)
  formData.append('subject', subject)
  formData.append('text', text)
  
  if (html) {
    formData.append('html', html)
  }

  const auth = Buffer.from(`api:${mailgunApiKey}`).toString('base64')

  try {
    const response = await fetch(`${mailgunBaseUrl}/v3/${mailgunDomain}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Mailgun API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export async function sendReportSubmissionNotification(
  reportData: {
    venueName: string
    forDate: string
    submittedBy: string
    totalSales: number
    grossRevenue: number
    netRevenue: number
  }
) {
  const { venueName, forDate, submittedBy, totalSales, grossRevenue, netRevenue } = reportData
  
  const subject = `New EOD Report Submitted - ${venueName} - ${forDate}`
  
  const text = `
A new End of Day report has been submitted.

Venue: ${venueName}
Date: ${forDate}
Submitted by: ${submittedBy}

Sales Summary:
- Total Sales: ${totalSales.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
- Gross Revenue: ${grossRevenue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}
- Net Revenue: ${netRevenue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}

Please review the report in the admin dashboard.
  `.trim()

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #059669; margin-bottom: 20px;">New EOD Report Submitted</h2>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #374151;">Report Details</h3>
        <p><strong>Venue:</strong> ${venueName}</p>
        <p><strong>Date:</strong> ${forDate}</p>
        <p><strong>Submitted by:</strong> ${submittedBy}</p>
      </div>
      
      <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; border-left: 4px solid #059669;">
        <h3 style="margin-top: 0; color: #374151;">Sales Summary</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin-bottom: 8px;"><strong>Total Sales:</strong> ${totalSales.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</li>
          <li style="margin-bottom: 8px;"><strong>Gross Revenue:</strong> ${grossRevenue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</li>
          <li style="margin-bottom: 8px;"><strong>Net Revenue:</strong> ${netRevenue.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</li>
        </ul>
      </div>
      
      <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
        Please review the report in the admin dashboard.
      </p>
    </div>
  `

  return sendEmail({
    to: 'shetty.aneet@gmail.com',
    subject,
    text,
    html,
  })
}
