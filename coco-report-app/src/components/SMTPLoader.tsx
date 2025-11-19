'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    smtp?: {
      mail: (options: {
        secure?: boolean
        host?: string
        port?: number
        to: string
        from: string
        subject: string
        body: string
        username?: string
        password?: string
        encrypted?: boolean
      }) => Promise<string>
    }
    smtpmailer?: any
    SMTPMailer?: any
  }
}

export default function SMTPLoader() {
  useEffect(() => {
    // Check if script is already loaded
    const checkSMTP = () => {
      if (typeof window === 'undefined') return false

      // Check if script tag exists
      const scriptTag = document.querySelector('script[src*="smtpmailer.vercel.app"]')
      if (!scriptTag) {
        console.warn('SMTP script tag not found in DOM')
        return false
      }

      // Try different possible global names and check for mail method
      const possibleNames = ['smtp', 'smtpmailer', 'SMTPMailer', 'SMTP']
      for (const name of possibleNames) {
        const obj = (window as any)[name]
        if (obj && typeof obj === 'object') {
          // Check if it has a mail method
          if (typeof obj.mail === 'function') {
            window.smtp = obj
            console.log(`SMTP Mailer initialized successfully from window.${name}`)
            return true
          }
          // Check if it's a constructor/class
          if (typeof obj === 'function' && obj.prototype && typeof obj.prototype.mail === 'function') {
            // Try to instantiate or use as static
            try {
              window.smtp = new obj() as any
              console.log(`SMTP Mailer initialized from ${name} constructor`)
              return true
            } catch (e) {
              // Try as static
              if (typeof obj.mail === 'function') {
                window.smtp = obj as any
                console.log(`SMTP Mailer initialized from ${name} static`)
                return true
              }
            }
          }
        }
      }

      // Debug: log what's actually on window
      if (scriptTag.getAttribute('data-loaded') !== 'true') {
        console.log('Available window properties:', Object.keys(window).filter(k => 
          k.toLowerCase().includes('smtp') || k.toLowerCase().includes('mail')
        ))
      }

      return false
    }

    // Check immediately
    if (checkSMTP()) {
      return
    }

    // If not found, wait for script to load
    let checkCount = 0
    const maxChecks = 100 // 10 seconds at 100ms intervals
    const interval = setInterval(() => {
      checkCount++
      if (checkSMTP()) {
        const scriptTag = document.querySelector('script[src*="smtpmailer.vercel.app"]')
        if (scriptTag) {
          scriptTag.setAttribute('data-loaded', 'true')
        }
        clearInterval(interval)
      } else if (checkCount >= maxChecks) {
        clearInterval(interval)
        const scriptTag = document.querySelector('script[src*="smtpmailer.vercel.app"]')
        if (scriptTag) {
          console.error('SMTP Mailer script tag exists but API not found')
          console.log('Script tag:', scriptTag)
          console.log('Window object keys:', Object.keys(window).slice(0, 50))
        } else {
          console.error('SMTP Mailer script tag not found in DOM')
        }
      }
    }, 100)

    // Also listen for script load event
    const scriptTag = document.querySelector('script[src*="smtpmailer.vercel.app"]')
    if (scriptTag) {
      scriptTag.addEventListener('load', () => {
        console.log('SMTP script load event fired')
        setTimeout(() => {
          if (checkSMTP()) {
            clearInterval(interval)
          }
        }, 500)
      })
      scriptTag.addEventListener('error', (e) => {
        console.error('SMTP script failed to load:', e)
        clearInterval(interval)
      })
    }

    return () => {
      clearInterval(interval)
    }
  }, [])

  return null
}

