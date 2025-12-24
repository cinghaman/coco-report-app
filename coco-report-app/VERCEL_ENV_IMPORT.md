# Vercel Environment Variables Import Guide

This guide helps you quickly import all environment variables to Vercel.

## Quick Import via Vercel Dashboard

### Step 1: Copy Environment Variables

Copy all the variables from `.env.example` or use the list below:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wnwzifhngkynpxknovii.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_mRwlPF-Tud5YVPObKmVhWw_wV_4H5QB
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NEXT_PUBLIC_APP_URL=https://coco-report-app.vercel.app
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=coco-notifications.info
MAILGUN_API_URL=https://api.eu.mailgun.net
MAILGUN_FROM_EMAIL=postmaster@coco-notifications.info
MAILGUN_FROM_NAME=Coco Reporting
```

### Step 2: Add to Vercel Dashboard

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project: **coco-report-app** (or your project name)
3. Go to **Settings** → **Environment Variables**
4. Click **Add New** for each variable
5. Select the environment(s): **Production**, **Preview**, **Development**
6. Paste the value and click **Save**

### Step 3: Important Notes

⚠️ **Replace these values:**
- `SUPABASE_SERVICE_ROLE_KEY` - Get from Supabase Dashboard → Settings → API → service_role key
- `MAILGUN_API_KEY` - Already set, but verify it's correct

✅ **These are already set correctly:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` (for password reset links)
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_API_URL`
- `MAILGUN_FROM_EMAIL`
- `MAILGUN_FROM_NAME`

### Step 4: Redeploy

After adding all variables, **redeploy** your application:
- Go to **Deployments** tab
- Click **⋯** (three dots) on latest deployment
- Click **Redeploy**

---

## Import via Vercel CLI

### Option 1: Import from .env.local

```bash
# 1. Create .env.local with your values
cp .env.example .env.local
# Edit .env.local and add your SUPABASE_SERVICE_ROLE_KEY

# 2. Pull existing Vercel env vars (optional)
vercel env pull .env.local

# 3. Push to Vercel (for each environment)
vercel env add NEXT_PUBLIC_SUPABASE_URL production < .env.local
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production < .env.local
# ... repeat for each variable
```

### Option 2: Add Variables One by One

```bash
# Login to Vercel
vercel login

# Link project (if not already linked)
cd coco-report-app
vercel link

# Add each variable (you'll be prompted to enter the value)
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add MAILGUN_API_KEY production
vercel env add MAILGUN_DOMAIN production
vercel env add MAILGUN_API_URL production
vercel env add MAILGUN_FROM_EMAIL production
vercel env add MAILGUN_FROM_NAME production

# Repeat for preview and development environments
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# ... etc
```

---

## Required Variables Checklist

### Supabase (3 variables)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **You need to get this from Supabase**

### App URL (1 variable)
- [ ] `NEXT_PUBLIC_APP_URL` ✅ Set to `https://coco-report-app.vercel.app` (required for password reset links)

### Mailgun (5 variables)
- [ ] `MAILGUN_API_KEY` ✅ Already provided
- [ ] `MAILGUN_DOMAIN` ✅ Already provided
- [ ] `MAILGUN_API_URL` ✅ Already provided
- [ ] `MAILGUN_FROM_EMAIL` ✅ Already provided
- [ ] `MAILGUN_FROM_NAME` ✅ Already provided

---

## Getting Your Supabase Service Role Key

1. Go to https://supabase.com/dashboard
2. Select project: **coco-reporting-system**
3. Go to **Settings** → **API**
4. Find **service_role** key (⚠️ Keep this secret!)
5. Copy and paste into Vercel environment variables

---

## Verification

After adding all variables, verify they're set:

```bash
# List all environment variables
vercel env ls

# Or check in Vercel Dashboard
# Settings → Environment Variables
```

---

## Troubleshooting

### Variables not working after deployment?
- Make sure you selected the correct environment (Production/Preview/Development)
- **Redeploy** your application after adding variables
- Check Vercel deployment logs for errors

### Need to update a variable?
- Go to Vercel Dashboard → Settings → Environment Variables
- Click on the variable → Edit → Update value → Save
- Redeploy

### Variables showing as undefined?
- Check variable names match exactly (case-sensitive)
- Ensure you've redeployed after adding variables
- Verify the environment (Production/Preview/Development) matches your deployment

---

**Last Updated:** January 21, 2025

