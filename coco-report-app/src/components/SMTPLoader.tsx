'use client'

import { useEffect } from 'react'

export default function SMTPLoader() {
  useEffect(() => {
    // Check if script is already loaded
    const checkSMTP = () => {
      if (typeof window !== 'undefined') {
        // Try different possible global names
        const smtp = (window as any).smtp || (window as any).smtpmailer || (window as any).SMTPMailer
        if (smtp) {
          window.smtp = smtp
          console.log('SMTP Mailer initialized successfully')
          return true
        }
      }
      return false
    }

    // Check immediately
    if (checkSMTP()) {
      return
    }

    // If not found, wait for script to load
    const interval = setInterval(() => {
      if (checkSMTP()) {
        clearInterval(interval)
      }
    }, 100)

    // Cleanup after 10 seconds
    const timeout = setTimeout(() => {
      clearInterval(interval)
      if (!window.smtp) {
        console.warn('SMTP Mailer script not loaded after 10 seconds')
      }
    }, 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  return null
}

