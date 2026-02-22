# Consist SaaS (Next.js)

This is a starter SaaS structure for a subscription-based trading journal.

## What is included
- Next.js App Router project (`src/`)
- Basic pages: `/`, `/login`, `/pricing`, `/app`
- Route protection via `src/proxy.ts`
- Supabase Auth (email + password + Google OAuth)
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
2. If you previously used the email-based schema, run `supabase/migrate_email_to_user_id.sql` once to migrate existing records.
3. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel env vars.
4. In Supabase Auth enable Google provider and configure Google OAuth credentials.
5. In Supabase URL Configuration set Site URL to your Vercel domain and allow `/auth/callback`.
6. Use `/login` to create accounts or sign in with Google.
7. Connect crypto checkout provider (or Stripe) and in webhook update `user_subscriptions`.
8. Verify webhook signatures and activate subscriptions in DB.
9. Deploy to Vercel.
