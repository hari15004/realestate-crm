# Real Estate CRM - Handoff Notes
Last updated: 24 Oct 2026

## Goal
Simple, free, mobile-friendly CRM for a small Indian real-estate sales and marketing team.
Journey: Lead -> qualification -> call -> follow-up -> site visit -> negotiation -> booking/sold OR lost.
NOT an enterprise CRM. Do not over-engineer. A new user should understand it in 5 minutes.

## Owner and working rules (IMPORTANT - follow exactly)
- Owner (goes by Jams) is a complete beginner (programming and electronics). Explain very simply.
- Owner chats in Hinglish, so reply in Hinglish. ALL app/UI text must be in ENGLISH.
- Keep replies SHORT. Owner gets annoyed by long explanations and wasted tokens.
- Give ONE step at a time. Owner runs it and pastes the output back before the next step.
- For any file over ~50 lines: tell owner to run `code <path>` (VS Code), press Ctrl+A, paste the full file, Ctrl+S.
  Long terminal heredoc pastes have failed silently before. For tiny changes use exact `sed` commands.
- Verification: owner now dislikes many separate verify steps and extra tests. Use ONE combined check
  per change (wc -l + grep/tail, and `npx tsc --noEmit` for code). Never assume success, but do not over-test.
- Everything must be FREE (free tiers only). No paid APIs or services. No fake or half-working features.
- Never put the Supabase service_role key in frontend code or chat. Never commit .env.local (it is git-ignored).
- Dev machine is a Linux laptop. Clicking a tel: link opens a KDE Connect popup there. That is normal.
- Only claim something works if the owner confirmed it. Say clearly what is untested.
- Line counts you estimate are often wrong. Trust the real output only.

## Stack, hosting, how to run
Next.js 16 (App Router, TypeScript, Tailwind), Supabase (Postgres + Auth, free plan, Mumbai region).
Project folder: ~/Desktop/realestate-crm
Run locally: npm run dev, open http://localhost:3000
GitHub (private): https://github.com/hari15004/realestate-crm (branch main)
Live (Vercel free): https://realestate-crm-self.vercel.app (auto-deploys on every git push to main)
Env vars (local .env.local AND Vercel): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
Extra Vercel-only secrets: META_VERIFY_TOKEN, SUPABASE_SERVICE_ROLE_KEY (server use only, in the webhook).
Not set yet (needed when Meta is set up): META_APP_SECRET, META_PAGE_ACCESS_TOKEN.
After adding or changing a Vercel env var, the owner must Redeploy for it to apply.
Supabase project name: realestate-crm. Test accounts: crm1 (admin) and crm2 (sales).
Public sign-ups are OFF. New team members are added in Supabase > Authentication > Users.
Their role is in the profiles table (default sales; admin must be set with SQL).
Next.js 16 note: the middleware file is src/proxy.ts (not middleware.ts).
next.config.ts: cacheComponents and partialPrefetching were removed on purpose.
proxy.ts uses supabase.auth.getClaims() (not getUser()) - this made page loads fast (proxy went from ~1.5s to ~30ms).
proxy.ts matcher excludes /api/meta-webhook (Meta cannot log in).
Theme: black dark theme is done in src/app/globals.css by overriding the Tailwind slate/white classes
(bg-white becomes dark grey, slate text becomes light). Pages still use the old class names on purpose.
Before deploy always run: npm run build (it passed on 24 Oct 2026).

## Database tables (all in schema public)
profiles: id, full_name, role (admin/sales/marketing), created_at. Created automatically by a trigger on signup.
properties: id, name, location, property_type, starting_price, available_units, status, created_at.
leads: id, lead_no (auto number), created_at, name, phone (10 digits), alt_phone, source, campaign, ad_set, ad,
  property_id, property_type, location, preferred_location, budget, payment_preference, purpose, timeline,
  status, score, quality, interest_level, assigned_to, next_followup_at, followup_type, followup_note,
  call_attempts, last_call_status, notes.
activities: id, lead_id, type, detail, call_result, done_by, created_at (the lead timeline).
site_visits: id, lead_id, property_id, visit_at, assigned_to, status, notes, created_at.
settings: key, value (jsonb). Row key 'scoring' holds the editable scoring rules.
Security (RLS) was locked down on 24 Oct 2026 with SQL, including a helper function public.is_admin():
- leads, activities, site_visits: any logged-in user can read and write.
- properties, settings: everyone can read, only admin can write.
- profiles: everyone can read, only admin can update (nobody can change their own role).
Note: a sales user could still read the settings table; that is fine (only scoring rules live there).

## Values used in the app
Lead statuses: New, Contacted, Interested, Follow-up, Site Visit Planned, Site Visit Done, Negotiation,
  Booked, Sold, Not Interested, Lost.
Closed statuses (no follow-ups, hidden from active lists): Booked, Sold, Not Interested, Lost.
Sources: Meta, Instagram, Website, WhatsApp, Referral, Phone, Other.
Call results: Connected, Not connected, Call back requested, Invalid number.
Site visit statuses: Planned, Completed, Cancelled, Rescheduled.
Payment preference: Cash, Home loan, Part cash + part loan, Not decided.
Interest level: High, Medium, Low.
Quality from score: Best (70+), Good (45+), Medium (25+), Poor (below 25) - defaults, editable by admin.
Score is only a priority indicator, never a prediction of buying.

## Files that exist
- src/proxy.ts: redirects to /login when logged out (uses getClaims)
- src/lib/supabase/client.ts and server.ts: Supabase helpers
- src/lib/scoring.ts: calculateScore(), default SCORING_RULES, applyRules(), loads saved rules from settings (browser)
- src/lib/autoAssign.ts: pickAssignee() - gives new lead to the sales/admin person with fewest open leads
- src/lib/exportXlsx.ts: downloadXlsx() using the free exceljs package
- src/components/SmartTips.tsx: dashboard "Smart Suggestions" (rule based, no AI)
- src/components/LeadCharts.tsx: dashboard bar charts (Leads by Status / Source), pure CSS
- src/app/login/page.tsx: login page
- src/app/(app)/layout.tsx: sidebar (desktop) / top pills (mobile)
- src/app/(app)/page.tsx: Dashboard (8 count cards, smart tips, charts, priority leads, today's follow-ups)
- src/app/(app)/leads/page.tsx: leads list, search, filters (status/quality/source + more: campaign, budget in lakh, dates, assigned to), Call and WhatsApp buttons
- src/app/(app)/leads/new/page.tsx: Add Lead (project dropdown, payment preference, interest level, duplicate phone -> Merge / Save anyway / Cancel, auto score, auto assign, follow-up next day 10 AM)
- src/app/(app)/leads/[id]/page.tsx: lead detail (timeline, Call, Add Note, Set Follow-up, Change Status, Schedule Site Visit, link to Edit)
- src/app/(app)/leads/[id]/edit/page.tsx: edit lead details + assign / reassign
- src/app/(app)/followups/page.tsx: Overdue / Today / Tomorrow
- src/app/(app)/site-visits/page.tsx: Missed / Today / Upcoming / Completed (Completed, Reschedule, Cancel)
- src/app/(app)/properties/page.tsx: projects list, admin-only Add/Edit buttons
- src/app/(app)/reports/page.tsx: Daily Report with Copy Report button
- src/app/(app)/settings/page.tsx: CSV Export, Excel Export, sample file, CSV Import (skips duplicate phones), link to Scoring Rules
- src/app/(app)/settings/scoring/page.tsx: admin-only scoring rules editor (Save, Recalculate all, Reset)
- src/app/api/meta-webhook/route.ts: Meta Lead Ads webhook (GET verify, POST with signature check, creates lead with service_role key)
All pages are client components that call Supabase directly with the logged-in user's session (except the webhook).

## Test status
Confirmed working by the owner: login, sidebar, dark theme, leads list, Add Lead, lead detail actions,
  follow-ups page, dashboard, properties add/edit, reports page opens, CSV export, Excel export,
  Vercel deploy (live app works after login), Meta webhook GET verification (returns the challenge).
Code written and passes tsc / next build, but NOT confirmed in the browser by the owner:
  project dropdown on Add Lead, Edit Lead page and Reassign, auto assign, Smart Suggestions box, dashboard charts,
  WhatsApp button, Scoring Rules screen (save / recalculate / admin-only), More filters on leads list,
  Merge duplicate, payment preference and interest level fields.
NOT tested at all: site visits page buttons (Completed / Reschedule / Cancel), CSV import,
  Copy Report text, mobile layout on a real phone, logged-out redirect to /login on the live site,
  the new RLS rules with a sales (crm2) account, the Meta webhook POST (needs a real Meta app).

## Known gaps (do these next, in this order)
1. Owner should test the unconfirmed items above and report bugs. Fix them.
2. Add payment preference and interest level to the Edit Lead page and show them on the lead detail page.
   Also show the project name on the lead detail page.
3. Daily report by free email or free scheduled job (design only first, no paid service). Free options to evaluate:
   Vercel cron on the free plan plus a free email service tier, or a "Copy report for WhatsApp" flow.
4. Free AI helper (lead summary / next action). Only use a genuinely free API tier, explain the data-privacy
   tradeoff to the owner first, and keep it optional. Rule-based Smart Suggestions already exist.
5. Meta Lead Ads setup (owner has a Facebook Page but no ads or Meta developer app yet): create Meta app,
   subscribe the webhook to the leadgen field with the verify token, set META_APP_SECRET and META_PAGE_ACCESS_TOKEN
   in Vercel, redeploy, then test with Meta's Lead Ads Testing Tool. The route is already written.
6. Mobile polish and premium look: animations, nicer cards, check on a real phone.
7. Cleanup: the Next.js dev warning about npm audit is ignored on purpose; do not run npm audit fix blindly.