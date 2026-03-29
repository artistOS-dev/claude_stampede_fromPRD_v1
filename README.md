# Stampede

> The home of country music — fan community platform

## What This Is

Stampede is a country music fan community app where listeners discover their music personality, join artist Circles, rate songs, and connect with other fans. New users go through a 6-step onboarding flow:

1. **Create account** — email + password signup
2. **Verify email** — confirm via magic link
3. **Pick a display name** — unique handle
4. **Take the personality quiz** — find your music identity (Traditionalist, Trailblazer, Storyteller, etc.)
5. **Choose Circles** — join communities matched to your taste
6. **Select a subscription tier** — Free, Fan ($4.99/mo), or Superfan ($9.99/mo)

Once onboarded, users can rate songs, vote in polls, chat in Circle feeds, and invite friends.

---

## Project Structure

This is a monorepo containing two apps and shared backend config:

```
stampede/
├── apps/
│   ├── web/          # Next.js 14 web app (deployed on Vercel)
│   └── mobile/       # Expo React Native app (iOS + Android)
├── supabase/
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Full DB schema + RLS policies
│   ├── seed.sql                     # 6 sample Circles to populate the DB
│   └── config.toml                  # Supabase CLI local dev config
├── vercel.json                      # Vercel deployment config
├── package.json                     # Root monorepo scripts
└── .gitignore
```

- **`apps/web`** — The Next.js web app. All pages, API routes, and UI components live here.
- **`apps/mobile`** — The Expo app for iOS and Android. Shares the same Supabase backend.
- **`supabase/`** — Database schema, seed data, and local dev configuration. Run migrations against your hosted Supabase project via the SQL Editor.

---

## Prerequisites

Before you start, make sure you have accounts and tools ready:

- **Node.js 18+** — [Download here](https://nodejs.org)
- **A Supabase account (free)** — [supabase.com](https://supabase.com)
- **A Vercel account (free)** — [vercel.com](https://vercel.com)
- **A Stripe account (for payments)** — [stripe.com](https://stripe.com)
- **Git** — to clone the repo

---

## Step 1: Set Up Supabase

Supabase is the database and authentication backend. This step creates your database tables and loads sample data.

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account)
2. Click **New Project**, name it `stampede`, choose a strong database password, and save it somewhere safe
3. Select a region close to you and click **Create new project**
4. Wait about 2 minutes for the project to spin up — you'll see a green "Project is ready" indicator

**Get your API keys:**

5. In your project, go to **Settings → API** (left sidebar)
6. Copy these three values — you'll need them later:
   - **Project URL** → this is your `SUPABASE_URL` (looks like `https://abcdefgh.supabase.co`)
   - **anon / public** key → this is your `SUPABASE_ANON_KEY` (safe to use in the browser)
   - **service_role / secret** key → this is your `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — never expose it in client code)

**Run the database schema:**

7. In your Supabase project, click **SQL Editor** in the left sidebar
8. Click **New query**
9. Open the file `supabase/migrations/001_initial_schema.sql` from this repo, copy the entire contents, paste it into the editor, and click **Run**
10. You should see "Success. No rows returned" — this means all tables, triggers, and security policies were created

**Load sample data:**

11. Click **New query** again
12. Open `supabase/seed.sql`, copy the entire contents, paste it in, and click **Run**
13. This inserts 6 sample Circles (Outlaw Radio, New Boot Goofin, Porch Sessions, etc.) so the app has content to display

**Configure authentication URLs:**

14. Go to **Authentication → URL Configuration** in the left sidebar
15. Set **Site URL** to your Vercel URL — you'll get this in Step 3, so come back and update it after deploying. For now you can leave it as-is.
16. Under **Redirect URLs**, add: `https://your-app.vercel.app/auth/callback` (update with your real URL after Step 3)

**Create avatar storage:**

17. Go to **Storage** in the left sidebar
18. Click **New bucket**, name it `avatars`, tick **Public bucket**, and click **Create bucket**

---

## Step 2: Set Up Stripe (for paid subscription tiers)

Stripe handles Fan and Superfan subscription payments. If you want to launch with only the free tier, you can skip this step and add Stripe later.

1. Go to [stripe.com](https://stripe.com) and create an account (or sign in)
2. Make sure you're in **Test mode** (toggle in the top-right) while developing

**Get your API keys:**

3. Go to **Developers → API keys**
4. Copy:
   - **Publishable key** (starts with `pk_test_`) → `STRIPE_PUBLISHABLE_KEY`
   - **Secret key** (starts with `sk_test_`) → `STRIPE_SECRET_KEY`

**Create subscription products:**

5. Go to **Products** → click **Add product**
6. Create the **Fan** tier:
   - Name: `Fan`
   - Click **Add price** → Recurring → Monthly → set your price (e.g. $4.99)
   - Click **Save product**
   - Copy the **Price ID** (starts with `price_`) → `STRIPE_FAN_PRICE_ID`
7. Create the **Superfan** tier:
   - Name: `Superfan`
   - Click **Add price** → Recurring → Monthly → set your price (e.g. $9.99)
   - Click **Save product**
   - Copy the **Price ID** → `STRIPE_SUPERFAN_PRICE_ID`

> **Note on pricing**: Subscription prices are marked `[OPEN-S02]` in the functional spec — set whatever makes sense for your business. The app reads prices from environment variables.

**Set up webhooks** (so Stripe notifies your app when subscriptions change):

8. Go to **Developers → Webhooks** → click **Add endpoint**
9. Set the URL to: `https://your-app.vercel.app/api/webhooks/stripe` (use your real Vercel URL after Step 3)
10. Under **Select events**, choose:
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
11. Click **Add endpoint**
12. Click on your new webhook, then click **Reveal** next to **Signing secret** → copy it → `STRIPE_WEBHOOK_SECRET`

---

## Step 3: Deploy the Web App to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your GitHub repository (you may need to grant Vercel access to your GitHub org)
4. On the configuration screen:
   - **Framework Preset**: Vercel should auto-detect Next.js
   - **Root Directory**: set to `apps/web`
5. Expand **Environment Variables** and add each of the following (click **Add** after each one):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | From Step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | From Step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | From Step 1 (keep secret) |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | From Step 2 |
   | `STRIPE_SECRET_KEY` | From Step 2 (keep secret) |
   | `STRIPE_WEBHOOK_SECRET` | From Step 2 |
   | `STRIPE_FAN_PRICE_ID` | From Step 2 |
   | `STRIPE_SUPERFAN_PRICE_ID` | From Step 2 |
   | `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` (your Vercel URL) |

6. Click **Deploy**
7. Vercel will build and deploy the app. When it finishes, you'll see your live URL (e.g. `https://stampede.vercel.app`)

**After deploying — go back and update Supabase:**

8. Copy your live Vercel URL
9. Go back to Supabase → **Authentication → URL Configuration**
10. Update the **Site URL** to your Vercel URL
11. Add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**
12. Also update your Stripe webhook endpoint URL if you set it up with a placeholder

---

## Step 4: Run the Mobile App Locally

The mobile app runs on iOS and Android via [Expo Go](https://expo.dev/go) — no Xcode or Android Studio needed for development.

1. Install Expo CLI globally:
   ```bash
   npm install -g expo-cli
   ```

2. Navigate to the mobile directory:
   ```bash
   cd apps/mobile
   ```

3. Create your environment file by copying the example:
   ```bash
   cp .env.example .env
   ```

4. Open `.env` and fill in your Supabase values:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

5. Install dependencies:
   ```bash
   npm install
   ```

6. Start the development server:
   ```bash
   npm start
   ```

7. A QR code will appear in the terminal. Open the **Expo Go** app on your phone (available on the App Store and Google Play) and scan the QR code. The app will load on your device.

> **For production mobile builds** (submitting to the App Store / Google Play), see the [EAS Build documentation](https://docs.expo.dev/build/introduction/).

---

## Step 5: Local Web Development

To run the web app on your own machine:

1. Install all dependencies from the repo root:
   ```bash
   npm install
   ```

2. Create the local environment file for the web app:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```
   Then open `apps/web/.env.local` and fill in your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   STRIPE_FAN_PRICE_ID=price_xxx
   STRIPE_SUPERFAN_PRICE_ID=price_xxx
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Start the web app:
   ```bash
   npm run dev:web
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. To run the mobile app at the same time (in a separate terminal):
   ```bash
   npm run dev:mobile
   ```

---

## Open Items

The following items are noted in the functional spec as pending business or design decisions. They do not block the initial launch but will need to be resolved:

| ID | Item |
|---|---|
| `[OPEN-S01]` | Personality type → Circle matching algorithm (how quiz results map to recommended Circles) |
| `[OPEN-S02]` | Subscription pricing (set in Stripe, values loaded from environment variables) |
| `[OPEN-S03]` | Stripe webhook full integration (subscription lifecycle → update user tier in Supabase) |
| `[OPEN-S04]` | Social sign-in (Apple / Google OAuth) — planned for v2 |
| `[OPEN-S05]` | Email template designs (confirmation, welcome, invite emails) |
| `[OPEN-S06]` | Analytics integration (Amplitude or Mixpanel) |
| `[OPEN-S07]` | Invite link click tracking and attribution |

---

## Architecture

| Layer | Technology | Notes |
|---|---|---|
| **Web frontend** | Next.js 14 (App Router) | Deployed on Vercel |
| **Mobile app** | Expo React Native | iOS + Android via Expo Go / EAS Build |
| **Database** | Supabase (PostgreSQL) | Hosted, free tier available |
| **Authentication** | Supabase Auth | Email/password + magic link verification |
| **File storage** | Supabase Storage | Avatar images in `avatars` bucket |
| **Payments** | Stripe | Fan and Superfan subscription tiers |
| **Deployment** | Vercel | Auto-deploys on push to main branch |

### How auth works

1. User signs up with email + password via Supabase Auth
2. Supabase sends a verification email with a magic link
3. On click, the user is redirected to `/auth/callback` — this exchanges the token for a session
4. A database trigger automatically creates a row in `public.profiles` the moment the `auth.users` row is inserted
5. The onboarding flow (Steps 3–6) fills in the rest of the profile

### Database tables

- **`profiles`** — One row per user. Extends Supabase's built-in `auth.users` table with display name, personality types, subscription tier, and Stripe IDs.
- **`circles`** — Country music fan communities. Each Circle has core artists, personality tags, and a member count.
- **`circle_members`** — Join table linking users to Circles. Tracks membership status (active/pending/banned) and role (member/board/founder).
- **`circle_invites`** — Invite link tokens for sharing Circles. Supports max-use limits and expiry dates.

---

## Troubleshooting

**"Invalid API key" error on Vercel**
Double-check that all environment variables are set correctly in the Vercel dashboard under **Settings → Environment Variables**. Make sure there are no extra spaces.

**Email confirmation link not working**
Verify that your Supabase **Site URL** and **Redirect URLs** are updated with your actual Vercel domain (not the placeholder `your-app.vercel.app`).

**Stripe webhook not receiving events**
Make sure the webhook endpoint URL in Stripe matches your deployed Vercel URL exactly: `https://your-domain.vercel.app/api/webhooks/stripe`. Also confirm you copied the **Signing secret** (not the API secret key).

**Mobile app showing blank screen**
Check that `apps/mobile/.env` exists and contains valid `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` values. Restart the Expo dev server after changing `.env`.

**"Row level security" errors in Supabase logs**
This usually means a request is being made with an anonymous session where an authenticated one is required. Make sure the user is signed in before making requests to protected tables. Use the `service_role` key only in server-side API routes, never in client-side code.
