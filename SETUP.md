# BuyIn Poker Ledger - Setup Guide

Follow these steps to get your poker ledger application up and running.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or cloud)
- Google Cloud account (for OAuth)

## Step 1: Install Dependencies

Dependencies should already be installed, but if needed:

```bash
npm install
```

## Step 2: Set Up PostgreSQL Database

### Option A: Local PostgreSQL

1. Install PostgreSQL if you haven't already
2. Create a new database:
   ```sql
   CREATE DATABASE buyin;
   ```
3. Update `.env` with your connection string:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/buyin?schema=public"
   ```

### Option B: Cloud Database (Recommended for beginners)

Use a free PostgreSQL service:
- **Supabase** (https://supabase.com) - Free tier available
- **Neon** (https://neon.tech) - Free tier available
- **Railway** (https://railway.app) - Free tier available

1. Sign up and create a new PostgreSQL database
2. Copy the connection string
3. Update `.env` with the connection string

## Step 3: Generate NextAuth Secret

Generate a random secret for NextAuth:

**On Windows (PowerShell):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**Or use an online generator:**
- Visit: https://generate-secret.vercel.app/32
- Copy the generated secret
- Update `NEXTAUTH_SECRET` in `.env`

## Step 4: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. **Configure OAuth Consent Screen** (REQUIRED - This fixes "access blocked" errors):
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" (unless you have a Google Workspace account)
   - Fill in the required fields:
     - **App name**: "BuyIn" (or any name you prefer)
     - **User support email**: Select your email from the dropdown
     - **Developer contact information**: Enter your email address
   - Click "Save and Continue"
   - On the "Scopes" page: Click "Save and Continue" (no additional scopes needed for basic login)
   - On the "Test users" page:
     - Click "+ ADD USERS"
     - Add your Google email address (the one you'll use to sign in)
     - You can add multiple test users if needed
     - Click "Save and Continue"
   - Review the summary and return to the dashboard
4. Enable Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and click "Enable"
5. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application" as the application type
   - Add authorized redirect URI:
     - Development: `http://localhost:3000/api/auth/callback/google`
     - Production: `https://yourdomain.com/api/auth/callback/google` (when deploying)
   - Click "Create"
6. Copy the Client ID and Client Secret
7. Update `.env` with your credentials:
   ```
   GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="your-client-secret"
   ```

**Important Notes:**
- The OAuth consent screen must be configured BEFORE creating OAuth credentials
- If you see "access blocked" error, make sure:
  - Your email is added as a test user in the OAuth consent screen
  - The redirect URI matches exactly (including http/https and port number)
  - The OAuth consent screen is published (or you're using a test user account)

## Step 5: Run Database Migrations

Create the database tables:

```bash
npx prisma migrate dev --name init
```

This will:
- Create all the database tables
- Generate the Prisma Client

## Step 6: Start the Development Server

```bash
npm run dev
```

The application will be available at: http://localhost:3000

## Step 7: Test the Application

1. Open http://localhost:3000
2. You should be redirected to the login page
3. Click "Sign in with Google"
4. Complete the OAuth flow
5. You should be redirected to the dashboard

## Troubleshooting

### Database Connection Issues

- Verify your `DATABASE_URL` is correct
- Make sure PostgreSQL is running
- Check firewall settings if using a remote database

### OAuth Issues

**"Access blocked" Error:**
- Make sure you've configured the OAuth consent screen (Step 4, part 3)
- Verify your email is added as a test user in the OAuth consent screen
- Check that the app is in "Testing" mode and you're using a test user email
- Wait a few minutes after making changes - Google sometimes needs time to propagate

**Other OAuth Issues:**
- Verify redirect URI matches exactly (including http/https and port)
- Check that Google+ API is enabled
- Ensure Client ID and Secret are correct in your `.env` file
- Make sure you've restarted your dev server after updating `.env`

### Prisma Issues

- Run `npx prisma generate` to regenerate the client
- Check that your database URL is accessible

## Next Steps

Once set up, you can:
- Create your first game
- Add players
- Track buy-ins and cash-outs
- View statistics

Enjoy tracking your poker games! 🎰
