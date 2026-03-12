# Project Context (consist.online)

Last updated: 2026-03-07

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Supabase (auth + data)
- Twelve Data API (price history for Trade Share)
- `html-to-image` for PNG export

## Product Scope
- Core app: discipline tracker with calendar, streaks, score, and subscription gating.
- Additional module: Trade Share builder (`/app/trade-share`) to generate shareable trade cards from market data.

## Main Docs
- [README.md](./README.md): setup and deployment checklist.
- [supabase/schema.sql](./supabase/schema.sql): database schema.
- [supabase/migrate_email_to_user_id.sql](./supabase/migrate_email_to_user_id.sql): migration script.

## Env Requirements
From `.env.example`:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `TWELVE_DATA_API_KEY`
- `CRYPTO_WEBHOOK_SECRET`

## Key Areas in Code
- App layout/meta: `src/app/layout.tsx`
- Dashboard page: `src/app/app/page.tsx`
- Trade Share page: `src/app/app/trade-share/page.tsx`
- Trade Share UI: `src/components/trade-share/TradeShareBuilder.tsx`
- Trade Share styles: `src/components/trade-share/TradeShareBuilder.module.css`
- Trade preview API: `src/app/api/trade-share/preview/route.ts`
- Symbol search API: `src/app/api/trade-share/symbols/route.ts`

## Recent Work (latest commits)
- `2c61772` Raise watermark and lower trade chart position
- `7c3134f` Set trade card watermark height to 120px
- `da1f3c3` Tune trade card visual scale for closer Figma match
- `7eaaea2` Fix Safari PNG export of trade chart by inlining SVG styles
- `0187267` Start trade share form with empty user inputs
- `1c33c29` Align trade share card layout to Figma node 78:1587
- `145823d` Add PNG download action for trade share card

## Current State / Where Work Stopped
- At audit start repository was clean; now there is one uncommitted file: `PROJECT_CONTEXT.md`.
- Focus area is Trade Share visual parity with Figma and export behavior.
- Trade card currently:
  - renders 450x600 composition
  - has dynamic symbol lookup and interval selection
  - computes entry/exit markers and trade segment from Twelve Data candles
  - supports PNG download client-side
- No active code task in progress yet in this session (we only audited project context and docs).

## Known Gaps / TODO
- `src/app/api/webhooks/crypto/route.ts`: TODO to persist payment status and activate subscription.
