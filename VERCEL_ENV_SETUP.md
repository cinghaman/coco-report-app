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

#### Add Resend API Key
```bash
vercel env add RESEND_API_KEY production
# When prompted, paste your Resend API key
```

#### Add Resend From Email (optional)
```bash
vercel env add RESEND_FROM_EMAIL production
# When prompted, enter: your-verified-email@yourdomain.com
```

#### Add Resend From Name (optional)
```bash
vercel env add RESEND_FROM_NAME production
# When prompted, enter: Coco Reporting
```

#### Add for all environments (Production, Preview, Development)
For each variable, run:
```bash
vercel env add RESEND_API_KEY preview
vercel env add RESEND_API_KEY development
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
- `RESEND_API_KEY` - Your Resend API key (get from https://resend.com/api-keys)

### Optional (with defaults):
- `RESEND_FROM_EMAIL` - Defaults to `onboarding@resend.dev`
- `RESEND_FROM_NAME` - Defaults to `Coco Reporting`

### Supabase (if not already set):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Important Notes

1. **After adding variables**, you must **redeploy** your application for changes to take effect
2. **Rotate your API key** if it was exposed in git history
3. **Never commit** `.env.local` or environment variables to git
4. Use **Production, Preview, and Development** environments as needed

## Getting Your Resend API Key

1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Give it a name (e.g., "Coco Reporting Production")
4. Copy the key (starts with `re_`)
5. **Important**: If your old key was exposed, delete it and create a new one

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

