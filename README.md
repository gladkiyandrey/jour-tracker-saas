# Jour SaaS (Next.js)

This is a starter SaaS structure for a subscription-based trading journal.

## What is included
- Next.js App Router project (`src/`)
- Basic pages: `/`, `/login`, `/pricing`, `/app`
- Route protection via `src/middleware.ts`
- Cookie-based mock auth/subscription flow
- Webhook placeholder: `POST /api/webhooks/crypto`

## Run
```bash
npm install
npm run dev
```

## Production steps
1. Replace mock auth with Supabase/Auth.js.
2. Add database (users, calendar entries, subscriptions).
3. Connect crypto checkout provider.
4. Verify webhook signatures and activate subscriptions in DB.
5. Deploy to Vercel.
