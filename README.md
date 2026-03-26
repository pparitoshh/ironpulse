# 🔥 IronPulse — AI-Powered Gym & Nutrition App

## Stack
- **Next.js 14** (App Router)
- **Supabase** (Postgres DB + Auth)
- **Google OAuth** (via NextAuth.js)
- **Groq** (LLaMA 3.3 70B — workout plan generation + macro estimation)
- **Gemini 1.5 Flash** (food photo scanning)
- **Vercel** (free hosting)

## Features
- 🤖 AI workout plan generation (gender, goal, level, equipment)
- 🏋️ Exercise logging: sets, reps, weight, RPE
- ⏱️ Rest timer between sets
- 🏆 Automatic PR detection
- 🍽️ Food logger: AI text description, photo scan (Gemini), manual entry
- 📊 Macro tracking (calories, protein, carbs, fat) with targets
- 📈 Progress charts (weight, workout volume)
- 💪 Body measurements tracker
- 🔥 Muscle group heatmap (recent training)

---

## Setup Guide

### 1. Clone & Install

```bash
git clone <your-repo>
cd ironpulse
npm install
```

### 2. Set up Supabase

1. Go to [supabase.com](https://supabase.com) → Create new project
2. Open **SQL Editor** → Run the contents of `supabase/schema.sql`
3. Copy your **Project URL** and **anon key** from Settings → API

### 3. Set up Google OAuth

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add `http://localhost:3000/api/auth/callback/google` to Authorized redirect URIs
5. Copy Client ID and Client Secret

### 4. Get API Keys (Free)

**Groq** (free, no credit card):
1. Go to [console.groq.com](https://console.groq.com)
2. Create account → API Keys → Create key

**Gemini** (free tier):
1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Get API key (free with Google account)

### 5. Configure Environment

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<run: openssl rand -base64 32>

GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx

NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

GROQ_API_KEY=gsk_xxx
GEMINI_API_KEY=AIzaxxx
```

### 6. Run Locally

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel (Free)

```bash
npm install -g vercel
vercel
```

Or connect GitHub repo at [vercel.com](https://vercel.com) and add env vars in project settings.

**For production**, also add to Google OAuth authorized redirect URIs:
```
https://your-app.vercel.app/api/auth/callback/google
```

---

## App Flow

1. **Sign in** with Google
2. **Onboarding** (6 steps): gender → goal → level → days/week → equipment → body stats
3. **AI generates** your weekly workout plan via Groq
4. **Dashboard**: today's workout, calorie ring, streak, muscle heatmap
5. **Workout tab**: log sets/reps/weight, rest timer, PR detection
6. **Food tab**: log meals via text AI, photo scan, or manual
7. **Progress tab**: charts, PRs, body measurements

---

## Free Tier Limits

| Service | Free Limit |
|---------|-----------|
| Groq | 30 req/min, 6000 req/day |
| Gemini Flash | 15 req/min, 1500 req/day |
| Supabase | 500MB DB, 2GB bandwidth |
| Vercel | Unlimited personal projects |

All free, no credit card required.
