# Admin Panel Setup

## Environment Variables

To enable admin functionality, you need to add the following environment variable to your `.env.local` file:

```bash
# Supabase Service Role Key (for admin operations)
# Get this from your Supabase project settings > API > service_role key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

## Getting the Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** > **API**
3. Copy the `service_role` key (not the `anon` key)
4. Add it to your `.env.local` file

## Admin Features

The admin panel allows you to:

### User Management
- **View all users** - See all registered users with their roles and last sign-in dates
- **Add new users** - Create new staff or admin accounts with venue access
- **Delete users** - Remove users from the system (reports remain intact)

### User Roles
- **Admin** - Full access to all venues and admin panel
- **Staff** - Limited to assigned venues only

### Safety Features
- **Report preservation** - Deleting a user does not affect their existing reports
- **Self-protection** - Admins cannot delete their own account
- **Confirmation dialogs** - All destructive actions require confirmation

## Accessing the Admin Panel

1. Log in as an admin user
2. Click "Admin" in the navigation header
3. Manage users from the admin panel

## User Creation Process

When creating a new user:
1. Fill in email, password, display name, and role
2. For staff users, select which venues they can access
3. Admin users automatically have access to all venues
4. Users are created with email confirmation already enabled
