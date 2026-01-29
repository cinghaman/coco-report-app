import Mailgun from 'mailgun.js'
import FormData from 'form-data'

export type SendUserCreationEmailsParams = {
  displayName: string
  email: string
  password: string
  role: string
  createdBy: string | null
  baseUrl: string
  adminEmails: string[]
}

const REQUIRED_ADMIN_EMAILS = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']

export async function sendUserCreationEmails(
  params: SendUserCreationEmailsParams
): Promise<{ adminSent: boolean; welcomeSent: boolean }> {
  const { displayName, email, password, role, createdBy, baseUrl, adminEmails } = params

  const mailgunApiKey = process.env.MAILGUN_API_KEY
  if (!mailgunApiKey) {
    console.warn('[email-user-creation] MAILGUN_API_KEY not set; skipping admin and welcome emails')
    return { adminSent: false, welcomeSent: false }
  }

  const domain = process.env.MAILGUN_DOMAIN || 'coco-notifications.info'
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `postmaster@${domain}`
  const fromName = process.env.MAILGUN_FROM_NAME || 'Coco Reporting'
  const mailgun = new Mailgun(FormData)
  const mg = mailgun.client({
    username: 'api',
    key: mailgunApiKey,
    url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net',
  })

  const allAdmins = [...new Set([...adminEmails, ...REQUIRED_ADMIN_EMAILS])].filter(Boolean)
  let adminSent = false
  let welcomeSent = false

  if (allAdmins.length > 0) {
    try {
      const adminHtml = `
        <h2>New User Created</h2>
        <p><strong>Name:</strong> ${displayName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Role:</strong> ${role}</p>
        <p><strong>Created by:</strong> ${createdBy ?? 'Admin'}</p>
        <p>The user has been automatically approved and can now log in.</p>
      `
      await mg.messages.create(domain, {
        from: `${fromName} <${fromEmail}>`,
        to: allAdmins,
        subject: `New User Created - ${displayName}`,
        html: adminHtml,
      })
      adminSent = true
      console.log('[email-user-creation] Admin notification sent to:', allAdmins)
    } catch (e) {
      console.error('[email-user-creation] Admin notification failed:', e)
    }
  }

  try {
    const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`
    const welcomeHtml = `
      <h2>Welcome to Coco Reporting System!</h2>
      <p>Hello ${displayName},</p>
      <p>Your account has been created successfully.</p>
      <p><strong>Your login credentials:</strong></p>
      <ul>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Password:</strong> ${password}</li>
      </ul>
      <p><strong>Important:</strong> Please change your password after your first login for security.</p>
      <p>Log in at: <a href="${loginUrl}">${loginUrl}</a></p>
      <p>If you have any questions, please contact your administrator.</p>
      <p>Best regards,<br>Coco Reporting Team</p>
    `
    await mg.messages.create(domain, {
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Welcome to Coco Reporting System',
      html: welcomeHtml,
    })
    welcomeSent = true
    console.log('[email-user-creation] Welcome email sent to:', email)
  } catch (e) {
    console.error('[email-user-creation] Welcome email failed:', e)
  }

  return { adminSent, welcomeSent }
}

export function getBaseUrl(request?: { nextUrl?: { origin?: string } }): string {
  const fromReq = request?.nextUrl?.origin
  if (fromReq) return fromReq
  const vercel = process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`
  const app = process.env.NEXT_PUBLIC_APP_URL
  if (app) return app
  return 'https://localhost:3000'
}
