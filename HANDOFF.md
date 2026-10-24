# Real Estate CRM - Handoff Notes
Last updated: 24 Oct 2026

## Goal
Simple, free, mobile-friendly CRM for a small Indian real-estate sales and marketing team.
Journey: Lead -> qualification -> call -> follow-up -> site visit -> negotiation -> booking/sold OR lost.
NOT an enterprise CRM. Do not over-engineer. A new user should understand it in 5 minutes.

## Owner and working rules (IMPORTANT - follow exactly)
- Owner is a complete beginner (programming and electronics). Explain very simply.
- Owner chats in Hinglish, so reply in Hinglish. ALL app/UI text must be in ENGLISH.
- Give ONE step at a time. Owner runs it and pastes the output back before the next step.
- For any file, give the FULL file to paste into `nano` (long heredoc pastes have failed silently before).
  For tiny changes use exact `sed` commands or "find this / replace with this" blocks.
- After every change ask for verification output (ls, wc -l, grep -c, tail -3). Never assume success.
  Line counts you estimate are often wrong, so trust the real output only.
- Everything must be FREE (free tiers only). No paid APIs or services. No fake or half-working features.
- Never put the Supabase service_role key in frontend code. Never commit .env.local.
- Dev machine is a Linux laptop. Clicking a tel: link opens a KDE Connect popup there. That is normal.
- Only claim something works if the owner confirmed it. Say clearly what is untested.

## Stack and how to run
Next.js 16 (App Router, TypeScript, Tailwind), Supabase (Postgres + Auth, free plan, Mumbai region).
Project folder: ~/Desktop/realestate-crm
Run: `npm run dev`, then open http://localhost:3000
Env vars in .env.local: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (anon/publishable key only).
Supabase project name: realestate-crm. Test accounts: crm1 (admin) and crm2 (sales).
Public sign-ups are OFF. New team members are added in Supabase > Authentication > Users.
Their role is in the profiles table (default sales; admin must be set with SQL).
Next.js 16 note: the middleware file is src/proxy.ts (not middleware.ts).
next.config.ts: cacheComponents and partialPrefetching were removed on purpose.

## Database tables (all in schema public)
profiles: id, full_name, role (admin/sales/marketing), created_at. Created automatically by a trigger on signup.
properties: id, name, location, property_type, starting_price, available_units, status, created_at.
leads: id, lead_no (auto number), created_at, name, phone (10 digits), alt_phone, source, campaign, ad_set, ad,
  property_id, property_type, location, preferred_location, budget, payment_preference, purpose, timeline,
  status, score, quality, interest_level, assigned_to, next_followup_at, followup_type, followup_note,
  call_attempts, last_call_status, notes.
activities: id, lead_id, type, detail, call_result, done_by, created_at (the lead timeline).
site_visits: id, lead_id, property_id, visit_at, assigned_to, status, notes, created_at.
settings: key, value (jsonb). Exists but is not used yet.
Security: Row Level Security is ON for every table. Current policy "team access" lets ANY logged-in user
read and write everything (see Known gaps).

## Values used in the app
Lead statuses: New, Contacted, Interested, Follow-up, Site Visit Planned, Site Visit Done, Negotiation,
  Booked, Sold, Not Interested, Lost.
Closed statuses (no follow-ups, hidden from active lists): Booked, Sold, Not Interested, Lost.
Sources: Meta, Instagram, Website, WhatsApp, Referral, Phone, Other.
Call results: Connected, Not connected, Call back requested, Invalid number.
Site visit statuses: Planned, Completed, Cancelled, Rescheduled.
Quality from score: Best (70+), Good (45+), Medium (25+), Poor (below 25). Rules are in src/lib/scoring.ts.
Score is only a priority indicator, never a prediction of buying.

## Files that exist
- src/proxy.ts: redirects to /login when logged out
- src/lib/supabase/client.ts and server.ts: Supabase helpers
- src/lib/scoring.ts: calculateScore() and editable SCORING_RULES
- src/app/login/page.tsx: login page
- src/app/(app)/layout.tsx: sidebar (desktop) / top pills (mobile)
- src/app/(app)/page.tsx: Dashboard (8 count cards, priority leads, today's follow-ups)
- src/app/(app)/leads/page.tsx: leads list, search, filters, Call button
- src/app/(app)/leads/new/page.tsx: Add Lead (duplicate phone warning, auto score, auto follow-up next day 10 AM)
- src/app/(app)/leads/[id]/page.tsx: lead detail (timeline, Call, Add Note, Set Follow-up, Change Status, Schedule Site Visit)
- src/app/(app)/followups/page.tsx: Overdue / Today / Tomorrow
- src/app/(app)/site-visits/page.tsx: Missed / Today / Upcoming / Completed (Completed, Reschedule, Cancel)
- src/app/(app)/properties/page.tsx: projects list, admin-only Add/Edit buttons
- src/app/(app)/reports/page.tsx: Daily Report with Copy Report button
- src/app/(app)/settings/page.tsx: CSV Export, sample file, CSV Import (skips duplicate phones)
All pages are client components that call Supabase directly with the logged-in user's session.

## Test status
Confirmed working by the owner: login, sidebar, leads list, Add Lead, lead detail actions,
  follow-ups page, dashboard, properties add/edit, reports page opens.
NOT confirmed yet: site visits page buttons (Completed / Reschedule / Cancel), duplicate phone warning,
  Settings CSV export and import, Copy Report text, mobile layout on a real phone.

## Known gaps (do these next, in order)
1. Test the unconfirmed items above and fix any bugs.
2. Add Lead form has no project/property dropdown, so site visits show Project "-". Add it.
3. Lock down database permissions: only admin should write to properties and settings, and nobody
   should be able to change their own role. Update RLS policies in SQL.
4. Edit lead details page (name, phone, budget, etc.) and an Assign / Reassign person option.
5. Duplicate handling: also offer "merge" (currently only Save anyway / Cancel).
6. Daily report by free email or free scheduled job (design only, no paid service).
7. Meta Lead Ads webhook route, protected by a secret env var, plus the CSV import as fallback.
8. Editable scoring rules screen (use the settings table).
9. Git commit and push to a PRIVATE GitHub repo, then deploy on the Vercel free tier with env vars.
10. Optional small features from the original spec (payment preference, interest level, filters by campaign/budget/date).
