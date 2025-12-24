# Mailgun Migration Summary

**Date:** January 21, 2025  
**Status:** ✅ Complete

## Overview

Migrated email sending functionality from Resend API to Mailgun API for all email notifications in the Coco Reporting App.

## Changes Made

### 1. Package Dependencies
- ✅ Added `mailgun.js` v11.1.0
- ✅ Added `form-data` v4.0.1
- ⚠️ Removed `resend` (can be removed after testing)

### 2. API Routes Updated
- ✅ `/api/send-email` - Authenticated email endpoint
- ✅ `/api/send-email-unauthenticated` - Public email endpoint (password reset)
- ✅ `/api/auth/reset-password` - Password reset email

### 3. Environment Variables

**Old (Resend):**
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_FROM_NAME`

**New (Mailgun):**
- `MAILGUN_API_KEY` (required)
- `MAILGUN_DOMAIN` (optional, defaults to `coco-notifications.info`)
- `MAILGUN_API_URL` (optional, defaults to `https://api.eu.mailgun.net`)
- `MAILGUN_FROM_EMAIL` (optional, defaults to `postmaster@coco-notifications.info`)
- `MAILGUN_FROM_NAME` (optional, defaults to `Coco Reporting`)

### 4. Documentation Updated
- ✅ `README.md` - Updated environment variable examples
- ✅ `VERCEL_ENV_SETUP.md` - Updated Vercel setup instructions
- ✅ Created `.env.example` (if not exists)

## Mailgun Configuration

### API Key
```
your_mailgun_api_key_here
```
**Note:** Get your actual API key from Mailgun dashboard. Do not commit API keys to git.

### Domain
```
coco-notifications.info
```

### API Endpoint
```
https://api.eu.mailgun.net
```

### From Address
```
postmaster@coco-notifications.info
```

## Email Types Supported

All email notifications now use Mailgun:

1. **Report Created** - Sent to admins when report is submitted
2. **Report Deleted** - Sent to admins when report is deleted
3. **User Created** - Sent to admins when new user is added
4. **Welcome Email** - Sent to new users with credentials
5. **Password Reset** - Sent to users requesting password reset

## Implementation Details

### Mailgun Client Initialization
```typescript
import Mailgun from 'mailgun.js'
import FormData from 'form-data'

const mailgun = new Mailgun(FormData)
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
  url: process.env.MAILGUN_API_URL || 'https://api.eu.mailgun.net'
})
```

### Sending Emails
```typescript
const data = await mg.messages.create(mailgunDomain, {
  from: `${fromName} <${fromEmail}>`,
  to: recipient,
  subject: subject,
  html: html,
  text: text, // optional
})
```

## Next Steps

1. **Install Dependencies:**
   ```bash
   cd coco-report-app
   npm install
   ```

2. **Update Environment Variables:**
   - Add `MAILGUN_API_KEY` to `.env.local`
   - Optionally set other Mailgun variables if different from defaults
   - Update Vercel environment variables for production

3. **Test Email Sending:**
   - Test password reset flow
   - Test report creation/deletion notifications
   - Test user creation notifications
   - Verify all email types are working

4. **Remove Resend (Optional):**
   ```bash
   npm uninstall resend
   ```

## Migration Checklist

- [x] Install Mailgun packages
- [x] Update `/api/send-email` route
- [x] Update `/api/send-email-unauthenticated` route
- [x] Update `/api/auth/reset-password` route
- [x] Update README.md
- [x] Update VERCEL_ENV_SETUP.md
- [x] Create environment variable documentation
- [ ] Test email sending in development
- [ ] Update Vercel environment variables
- [ ] Test email sending in production
- [ ] Remove Resend package (optional)

## Troubleshooting

### Common Issues

1. **"Mailgun API key not configured"**
   - Ensure `MAILGUN_API_KEY` is set in environment variables
   - Check `.env.local` for local development
   - Verify Vercel environment variables for production

2. **"Domain not found"**
   - Verify `MAILGUN_DOMAIN` matches your Mailgun domain
   - Check domain is verified in Mailgun dashboard

3. **"API endpoint error"**
   - Ensure using correct endpoint for your region (EU: `https://api.eu.mailgun.net`)
   - Check `MAILGUN_API_URL` is set correctly

4. **"From address not verified"**
   - Verify sender email in Mailgun dashboard
   - Use verified domain email addresses

## References

- [Mailgun API Documentation](https://documentation.mailgun.com/)
- [Mailgun.js Library](https://github.com/mailgun/mailgun-js)
- [EU API Endpoint](https://api.eu.mailgun.net)

