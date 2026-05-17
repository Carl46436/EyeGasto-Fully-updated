# EyeGasto Expense Tracker

EyeGasto is an Expo Router expense tracker for mobile and web. It uses Supabase Auth, PostgreSQL, and Storage so users can register, verify email OTPs, sign in with email or username, track expenses, attach receipts, manage budget limits, review analytics, and export reports.

## Features

- Email registration, 8-digit OTP verification, login, recovery OTP, and password reset
- First-time setup for username, monthly budget, currency, and app language
- Expense create, edit, delete, receipt upload, and offline pending sync
- Dedicated Overview, Budget, Stats, Gallery, and Profile dashboard tabs
- Category budgets and debt reminders stored in Supabase tables
- Spending momentum, category breakdown, receipt gallery, and export options
- Web deployment through Expo static export with Vercel or Netlify configs

## Tech Stack

- Expo SDK 54 with Expo Router
- React Native and React Native Web
- TypeScript
- Supabase Auth, PostgreSQL, and Storage
- EAS build/update configuration

## Project Structure

```text
expense_tracker/
  app/                  Expo Router routes only
  src/components/       UI screens and reusable components
  src/components/dashboard/
                        Dashboard helpers, types, and copy
  src/services/         Supabase, auth, expense, storage, currency services
  src/i18n/             Supported app language utilities
  src/types/            Shared TypeScript models
  supabase/migrations/  Database and storage schema
  assets/               App icons and screenshots
```

## Environment

Create `.env` in `expense_tracker/`:

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Run Locally

```bash
npm install
npx expo start
```

For web:

```bash
npm run web
```

## Build

```bash
npm run build:web
eas build -p android --profile apk
```

## Supabase Setup

Apply the migrations in `supabase/migrations/` before testing registration, expense sync, receipt uploads, budget planner, or debt reminders.

Required backend resources include:

- `expenses`
- `category_budgets`
- `debt_items`
- `user_profiles`
- `receipts` storage bucket
- `resolve_login_email(login_identifier text)` RPC

## Validation

```bash
npx tsc --noEmit
npm run lint
npm run build:web
```
