# Vercel Environment Variables Setup Guide

## Quick Setup Steps

### 1. Install Vercel CLI (if not already installed)
```bash
npm i -g vercel
```

### 2. Login to Vercel
```bash
vercel login
```

### 3. Link your project (if not already linked)
```bash
cd coco-report-app
vercel link
```

### 4. Add Environment Variables via CLI

#### Add Mailgun API Key (Required)
```bash
vercel env add MAILGUN_API_KEY production
# When prompted, paste your Mailgun API key
```

#### Add Mailgun Domain (optional, defaults to coco-notifications.info)
```bash
vercel env add MAILGUN_DOMAIN production
# When prompted, enter: coco-notifications.info
```

#### Add Mailgun API URL (optional, defaults to https://api.eu.mailgun.net)
```bash
vercel env add MAILGUN_API_URL production
# When prompted, enter: https://api.eu.mailgun.net
```

#### Add Mailgun From Email (optional, defaults to postmaster@coco-notifications.info)
```bash
vercel env add MAILGUN_FROM_EMAIL production
# When prompted, enter: postmaster@coco-notifications.info
```

#### Add Mailgun From Name (optional, defaults to Coco Reporting)
```bash
vercel env add MAILGUN_FROM_NAME production
# When prompted, enter: Coco Reporting
```

#### Add for all environments (Production, Preview, Development)
For each variable, run:
```bash
vercel env add MAILGUN_API_KEY preview
vercel env add MAILGUN_API_KEY development
# Repeat for other variables as needed
```

### 5. Verify Environment Variables
```bash
vercel env ls
```

### 6. Pull Environment Variables (for local development)
```bash
vercel env pull .env.local
```

## Required Environment Variables

### Required:
- `MAILGUN_API_KEY` - Your Mailgun API key (get from https://app.mailgun.com/app/api-keys)

### Optional (with defaults):
- `MAILGUN_DOMAIN` - Defaults to `coco-notifications.info`
- `MAILGUN_API_URL` - Defaults to `https://api.eu.mailgun.net` (EU endpoint)
- `MAILGUN_FROM_EMAIL` - Defaults to `postmaster@coco-notifications.info`
- `MAILGUN_FROM_NAME` - Defaults to `Coco Reporting`

### Supabase (if not already set):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Important Notes

1. **After adding variables**, you must **redeploy** your application for changes to take effect
2. **Rotate your API key** if it was exposed in git history
3. **Never commit** `.env.local` or environment variables to git
4. Use **Production, Preview, and Development** environments as needed

## Getting Your Mailgun API Key

1. Go to https://app.mailgun.com/app/api-keys
2. Find your Private API key (or create a new one)
3. Copy the key (format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxx-xxxx`)
4. **Important**: Keep your API key secure and never commit it to git
5. **Note**: For EU domains, make sure you're using the EU API endpoint (`https://api.eu.mailgun.net`)

## Troubleshooting

### Variables not working after deployment?
- Make sure you selected the correct environment (Production/Preview/Development)
- Redeploy your application after adding variables
- Check Vercel deployment logs for errors

### Need to update a variable?
- Go to Vercel Dashboard → Settings → Environment Variables
- Click on the variable → Edit → Update value → Save
- Redeploy

### Need to delete a variable?
- Go to Vercel Dashboard → Settings → Environment Variables
- Click on the variable → Delete
- Redeploy

