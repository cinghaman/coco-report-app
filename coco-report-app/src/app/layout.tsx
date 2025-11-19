import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import SMTPLoader from '@/components/SMTPLoader'
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
          id="smtp-mailer-script"
          src="https://smtpmailer.vercel.app/cdn.js" 
          strategy="afterInteractive"
        />
        <SMTPLoader />
      </body>
    </html>
  )
}