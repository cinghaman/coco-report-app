# Coco Reporting App

A modern, mobile-first daily reporting system for Coco venues built with Next.js, TypeScript, and Supabase.

## Features

- **Authentication**: Secure user authentication with role-based access control
- **Mobile-First Design**: Responsive interface optimized for mobile devices
- **Daily Reports**: Comprehensive end-of-day reporting with all required fields
- **Real-time Validation**: Live client-side validation with payment reconciliation
- **Cash Management**: Automatic previous day cash calculation
- **Draft & Submit**: Save drafts and submit reports for approval
- **Dashboard**: Overview of reports, stats, and quick actions

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Authentication**: Supabase Auth with SSR support
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Styling**: Tailwind CSS with responsive design

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd coco-reporting-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Update `.env.local` with your Supabase and Mailgun credentials:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Mailgun Email Configuration (Required for email notifications)
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=coco-notifications.info
MAILGUN_API_URL=https://api.eu.mailgun.net
MAILGUN_FROM_EMAIL=postmaster@coco-notifications.info
MAILGUN_FROM_NAME=Coco Reporting
```

**Note:** For Vercel deployment, add these environment variables in your Vercel project settings under Settings → Environment Variables.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   ├── reports/           # Report management pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── auth/              # Authentication components
│   ├── dashboard/         # Dashboard components
│   ├── layout/            # Layout components
│   └── reports/           # Report components
└── lib/                   # Utility libraries
    ├── auth.ts            # Authentication utilities
    └── supabase.ts        # Supabase client and types
```

## Database Schema

The app uses the following main tables:

- **venues**: Venue information
- **users**: User profiles and roles
- **daily_reports**: Daily sales reports
- **field_definitions**: Custom field definitions
- **report_field_values**: Custom field values
- **audit_logs**: Audit trail

## User Roles

- **staff**: Can create and edit their own reports
- **admin**: Can access all reports and manage system
- **owner**: Full system access

## API Endpoints

The app uses Supabase's auto-generated REST API:

- `GET /daily_reports` - List reports
- `POST /daily_reports` - Create report
- `PATCH /daily_reports/{id}` - Update report
- `POST /rpc/fn_prev_day_cash` - Get previous day cash
- `POST /rpc/fn_calc_reconciliation` - Calculate reconciliation

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Style

- TypeScript for type safety
- Tailwind CSS for styling
- ESLint for code quality
- Responsive design principles

## Deployment

The app can be deployed to Vercel, Netlify, or any platform that supports Next.js.

1. Build the app:
```bash
npm run build
```

2. Deploy to your preferred platform

3. Set environment variables in your deployment platform

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.