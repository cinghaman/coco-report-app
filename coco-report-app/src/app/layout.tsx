import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Coco Reporting - Daily Sales Management',
  description: 'End-of-day reporting system for Coco venues',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
        <Script 
          src="https://smtpmailer.vercel.app/cdn.js" 
          strategy="beforeInteractive"
          onLoad={() => {
            console.log('SMTP Mailer script loaded')
            if (typeof window !== 'undefined') {
              // Try different possible global names
              window.smtp = (window as any).smtp || (window as any).smtpmailer || (window as any).SMTPMailer
              if (window.smtp) {
                console.log('SMTP Mailer initialized successfully')
              } else {
                console.warn('SMTP Mailer script loaded but window.smtp not found')
              }
            }
          }}
          onError={(e) => {
            console.error('Failed to load SMTP Mailer script:', e)
          }}
        />
      </body>
    </html>
  )
}