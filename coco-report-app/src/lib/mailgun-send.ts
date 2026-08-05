import Mailgun from 'mailgun.js'
import FormData from 'form-data'

export type MailgunSendResult = {
  recipient: string
  success: boolean
  id?: string
  error?: string
}

/** Send one or more emails via Mailgun with an optional From display name. */
export async function sendMailgunEmails(params: {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  fromName?: string
}): Promise<{ message: string; results: MailgunSendResult[] }> {
  const mailgunApiKey = process.env.MAILGUN_API_KEY
  if (!mailgunApiKey) {
    throw new Error('MAILGUN_API_KEY is not configured')
  }

  const mailgunDomain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${mailgunDomain}`
  const fromName =
    (typeof params.fromName === 'string' && params.fromName.trim()) ||
    process.env.MAILGUN_FROM_NAME ||
    'Coco Reporting'

  const mailgun = new Mailgun(FormData)
  const mg = mailgun.client({
    username: 'api',
    key: mailgunApiKey,
    url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net',
  })

  const recipients = Array.isArray(params.to) ? params.to : [params.to]
  const results: MailgunSendResult[] = []

  for (const recipient of recipients) {
    try {
      const messageData: {
        from: string
        to: string
        subject: string
        html?: string
        text?: string
      } = {
        from: `${fromName} <${fromEmail}>`,
        to: recipient,
        subject: params.subject,
      }
      if (params.html) messageData.html = params.html
      if (params.text) messageData.text = params.text

      const data = await mg.messages.create(mailgunDomain, messageData)
      results.push({ recipient, success: true, id: data.id })
    } catch (error: unknown) {
      results.push({
        recipient,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const successCount = results.filter((r) => r.success).length
  return {
    message: `Email sending completed: ${successCount}/${results.length} sent successfully`,
    results,
  }
}
