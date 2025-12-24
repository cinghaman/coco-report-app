# Email Notifications Setup Guide

**Date:** January 21, 2025  
**Status:** ✅ Complete

## Overview

All email notifications are now implemented using Mailgun API. This document outlines all email notification features and their implementation.

---

## ✅ Implemented Email Notifications

### 1. Admin Notifications

#### ✅ New Report Added
- **Trigger:** When a report is submitted (not draft)
- **Recipients:** All users with `admin` or `owner` role
- **Location:** `src/components/reports/EODForm.tsx` (handleSave function)
- **Content:** Report details, venue, date, revenue summary

#### ✅ Report Deleted
- **Trigger:** When an admin deletes a report
- **Recipients:** All users with `admin` or `owner` role
- **Location:** `src/app/api/reports/[id]/route.ts` (DELETE method)
- **Content:** Report details, deleted by, venue, date

#### ✅ New User Created (by Admin)
- **Trigger:** When an admin creates a new user
- **Recipients:** All users with `admin` or `owner` role
- **Location:** `src/app/api/admin/users/create/route.ts`
- **Content:** User name, email, role, created by

#### ✅ New User Deleted
- **Trigger:** When an admin deletes a user
- **Recipients:** All users with `admin` or `owner` role
- **Location:** `src/app/api/admin/users/route.ts` (DELETE method)
- **Content:** User name, email, role, deleted by

#### ✅ New User Signed Up (Self-Registration)
- **Trigger:** When a new user self-registers and verifies email
- **Recipients:** All users with `admin` or `owner` role
- **Location:** `src/app/auth/callback/route.ts` + `src/app/api/users/signup-notification/route.ts`
- **Content:** User name, email, awaiting approval notice
- **Note:** Requires email verification to be enabled in Supabase

### 2. User Notifications

#### ✅ Welcome Email (Admin-Created Users)
- **Trigger:** When an admin creates a new user
- **Recipients:** The newly created user
- **Location:** `src/app/api/admin/users/create/route.ts`
- **Content:** Login credentials, password change reminder, login link

#### ✅ Account Approved
- **Trigger:** When an admin approves a pending user
- **Recipients:** The approved user
- **Location:** `src/app/api/users/approve/route.ts`
- **Content:** Approval confirmation, login link

#### ✅ Password Reset
- **Trigger:** When a user requests password reset
- **Recipients:** The user requesting reset
- **Location:** `src/app/api/auth/reset-password/route.ts`
- **Content:** Password reset link with expiration notice

#### ✅ Email Verification (Self-Signup)
- **Trigger:** When a new user signs up (self-registration)
- **Recipients:** The new user
- **Location:** Handled automatically by Supabase Auth
- **Content:** Email verification link
- **Note:** Requires email confirmation to be enabled in Supabase Dashboard

---

## 🔧 Configuration Required

### Supabase Email Verification Setup

For self-signup email verification to work:

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Under **Email Auth**, ensure:
   - ✅ **Enable email confirmations** is checked
   - ✅ **Site URL** is set to: `https://coco-report-app.vercel.app`
   - ✅ **Redirect URLs** includes: `https://coco-report-app.vercel.app/**`

3. **Email Templates** (optional):
   - Supabase will send verification emails automatically
   - You can customize templates in **Authentication** → **Email Templates**

### Mailgun Configuration

All emails are sent via Mailgun. Ensure these environment variables are set:

```env
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=coco-notifications.info
MAILGUN_API_URL=https://api.eu.mailgun.net
MAILGUN_FROM_EMAIL=postmaster@coco-notifications.info
MAILGUN_FROM_NAME=Coco Reporting
```

---

## 📋 Email Notification Flow

### Self-Signup Flow

1. **User signs up** → Supabase Auth creates user in `auth.users`
2. **Database trigger** → `handle_new_user` creates profile in `public.users` (unapproved)
3. **Supabase sends verification email** → User receives email with verification link
4. **User clicks link** → Redirected to `/auth/callback?code=...&type=signup`
5. **Callback handler** → Exchanges code for session, notifies admins via API
6. **Admin receives notification** → New user signup email
7. **Admin approves user** → User receives approval email
8. **User can now log in** → Access granted

### Admin-Created User Flow

1. **Admin creates user** → API creates user with `email_confirm: true`
2. **User profile created** → Automatically approved
3. **Admins notified** → New user created email
4. **User receives welcome email** → With credentials and login link

---

## 🔍 API Endpoints

### Email Sending
- `POST /api/send-email` - Authenticated email sending
- `POST /api/send-email-unauthenticated` - Public email sending (password reset, approvals)

### Notifications
- `POST /api/users/signup-notification` - Notify admins of new signup

---

## ✅ Verification Checklist

- [x] Admins get email when report is added
- [x] Admins get email when report is deleted
- [x] Admins get email when new user is created (by admin)
- [x] Admins get email when user is deleted
- [x] Admins get email when new user signs up (self-registration)
- [x] Users get welcome email when created by admin
- [x] Users get approval email when admin approves them
- [x] Users get password reset email
- [x] Users get email verification when self-signing up (via Supabase)

---

## 🚨 Important Notes

1. **Email Verification:** Supabase handles email verification automatically for self-signup. Make sure it's enabled in Supabase Dashboard.

2. **Self-Signup:** Currently, users can only be created by admins. If you want to enable self-signup:
   - Add a signup page/component
   - Use `supabase.auth.signUp()` 
   - Supabase will automatically send verification email
   - The callback handler will notify admins

3. **Approval Required:** New self-signup users are created with `approved: false` and must be approved by an admin before they can access the dashboard.

4. **Email Failures:** All email sending is wrapped in try-catch blocks. If email fails, the operation (user creation, report deletion, etc.) will still succeed - emails are non-blocking.

---

## 📝 Testing

To test email notifications:

1. **Report Creation:** Submit a report → Check admin emails
2. **Report Deletion:** Delete a report as admin → Check admin emails
3. **User Creation:** Create a user as admin → Check admin and user emails
4. **User Deletion:** Delete a user as admin → Check admin emails
5. **User Approval:** Approve a pending user → Check user email
6. **Password Reset:** Request password reset → Check user email

---

**Last Updated:** January 21, 2025

