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
    // Create a fallback implementation that calls the API directly
    const createFallbackSMTP = () => {
      if (!window.smtp) {
        window.smtp = {
          mail: async (params: any) => {
            try {
              const res = await fetch("https://smtpmailer.vercel.app/api/smtpmailer", {
                method: "POST",
                headers: {
                  Accept: "application/json, text/plain, */*",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
              });
              
              if (res.ok) {
                return await res.json();
              } else {
                throw new Error("Error sending email.");
              }
            } catch (error) {
              throw error;
            }
          }
        };
        console.log('SMTP Mailer fallback implementation created (using API directly)');
        return true;
      }
      return false;
    };

    // Check if script is already loaded
    const checkSMTP = () => {
      if (typeof window === 'undefined') return false

      // The script exposes window.smtp with a mail method
      // Check directly for window.smtp
      if ((window as any).smtp && typeof (window as any).smtp === 'object' && typeof (window as any).smtp.mail === 'function') {
        window.smtp = (window as any).smtp
        console.log('SMTP Mailer initialized successfully - window.smtp found from script')
        return true
      }

      return false
    }

    // Check immediately
    if (checkSMTP()) {
      return
    }

    // Also create fallback immediately in case script never loads
    // This ensures window.smtp is always available
    setTimeout(() => {
      if (!checkSMTP() && !window.smtp) {
        console.log('Creating SMTP fallback implementation (script may not expose window.smtp)')
        createFallbackSMTP()
      }
    }, 2000) // Wait 2 seconds, then create fallback if script hasn't loaded

    // Wait for script to load - check more frequently at first
    let checkCount = 0
    const maxChecks = 150 // 15 seconds at 100ms intervals
    const interval = setInterval(() => {
      checkCount++
      if (checkSMTP()) {
        clearInterval(interval)
        return
      }
      
      // Log progress every 2 seconds
      if (checkCount % 20 === 0) {
        const scriptTag = document.querySelector('script[src*="smtpmailer.vercel.app"], script[id="smtp-mailer-script"]')
        if (scriptTag) {
          console.log(`Waiting for SMTP script... (${checkCount * 0.1}s)`)
          // Debug: check what's on window
          if (checkCount === 20) {
            const smtpRelated = Object.keys(window).filter(k => 
              k.toLowerCase().includes('smtp') || k.toLowerCase().includes('mail')
            )
            console.log('SMTP-related window properties:', smtpRelated)
            console.log('window.smtp exists?', typeof (window as any).smtp !== 'undefined')
            if ((window as any).smtp) {
              console.log('window.smtp type:', typeof (window as any).smtp)
              console.log('window.smtp.mail exists?', typeof (window as any).smtp?.mail)
            }
          }
        } else {
          console.warn('SMTP script tag not found in DOM')
        }
      }

      if (checkCount >= maxChecks) {
        clearInterval(interval)
        const scriptTag = document.querySelector('script[src*="smtpmailer.vercel.app"], script[id="smtp-mailer-script"]')
        if (scriptTag) {
          console.warn('SMTP Mailer script tag exists but window.smtp not found after 15 seconds')
          console.log('Creating fallback implementation using API directly...')
          // Create fallback implementation
          createFallbackSMTP()
        } else {
          console.warn('SMTP Mailer script tag not found in DOM - creating fallback implementation')
          createFallbackSMTP()
        }
      }
    }, 100)

    // Also try to manually inject the script if Next.js Script component isn't working
    const existingScript = document.querySelector('script[src*="smtpmailer.vercel.app"], script[id="smtp-mailer-script"]')
    if (!existingScript) {
      console.log('SMTP script tag not found, attempting to load manually...')
      const script = document.createElement('script')
      script.id = 'smtp-mailer-script-manual'
      script.src = 'https://smtpmailer.vercel.app/cdn.js'
      script.async = true
      script.onload = () => {
        console.log('Manually loaded SMTP script - onload fired')
        setTimeout(() => {
          if (checkSMTP()) {
            clearInterval(interval)
          }
        }, 500)
      }
      script.onerror = (e) => {
        console.error('Manually loaded SMTP script failed:', e)
      }
      document.head.appendChild(script)
    } else {
      // Script tag exists, listen for load event
      existingScript.addEventListener('load', () => {
        console.log('SMTP script load event fired')
        setTimeout(() => {
          if (checkSMTP()) {
            clearInterval(interval)
          }
        }, 500)
      })
      existingScript.addEventListener('error', (e) => {
        console.error('SMTP script failed to load:', e)
      })
    }

    return () => {
      clearInterval(interval)
    }
  }, [])

  return null
}

