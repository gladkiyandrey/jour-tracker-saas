# Jour Tracker SaaS (Next.js)

This is a starter SaaS structure for a subscription-based trading journal.

## What is included
- Next.js App Router project (`src/`)
- Basic pages: `/`, `/login`, `/pricing`, `/app`
- Route protection via `src/proxy.ts`
- Supabase Auth (email + password)
- Supabase-backed tracker storage (`tracker_entries`)
- Supabase-backed subscription state (`user_subscriptions`)
- Webhook placeholder: `POST /api/webhooks/crypto`

## Run
```bash
npm install
npm run dev
```

## Production steps
1. Create Supabase project and run SQL from `supabase/schema.sql`.
2. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to Vercel env vars.
3. Use `/login` to create accounts and sign in with Supabase Auth.
4. Connect crypto checkout provider (or Stripe) and in webhook update `user_subscriptions`.
5. Verify webhook signatures and activate subscriptions in DB.
6. Deploy to Vercel.
