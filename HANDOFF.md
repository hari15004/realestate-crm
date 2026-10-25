# Real Estate CRM - Handoff Notes
Last updated: 25 Oct 2026

## Goal
Simple, free, mobile-friendly CRM for a small Indian real-estate sales and marketing team.
Journey: Lead -> qualification -> call -> follow-up -> site visit -> negotiation -> booking/sold OR lost.
NOT an enterprise CRM. Do not over-engineer. A new user should understand it in 5 minutes.
Owner wants the boss to say "super": new employees must never be confused, and the app should guide them
while talking to a lead.

## Owner and working rules (IMPORTANT - follow exactly)
- Owner (goes by Jams) is a complete beginner (programming and electronics). Explain very simply.
- Owner chats in Hinglish, so reply in Hinglish. ALL app/UI text must be in ENGLISH.
  Exception (owner asked for it): customer-facing call scripts and questions in the Call helper are in Hinglish.
- Keep replies SHORT. Owner gets annoyed by long explanations and wasted tokens.
- Give ONE step at a time. Owner runs it and pastes the output back before the next step.
- For any file over ~50 lines: tell owner to run `code <path>` (VS Code), press Ctrl+A, paste the full file, Ctrl+S.
  Long terminal heredoc pastes have failed silently before. For tiny changes use exact `sed` commands
  (or a small python3 replace script that prints PATCHED / NOT_PATCHED).
- Verification: ONE combined check per change (wc -l + grep/tail, and `npx tsc --noEmit` for code).
  Never assume success, but do not over-test.
- Everything must be FREE (free tiers only). No paid APIs or services. No fake or half-working features.
- Never put the Supabase service_role key in frontend code or chat. Never commit .env.local (it is git-ignored).
- Dev machine is a Linux laptop. Clicking a tel: link opens a KDE Connect popup there. That is normal.
  KDE Connect (phone paired) is the only free way to start a call from the laptop.
- Only claim something works if the owner confirmed it. Say clearly what is untested.
  If the owner replies only "done" or "ok" without the output, ask for the real result.
- Line counts you estimate are often wrong. Trust the real output only.
- Do not redesign or rewrite what already works.

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
proxy.ts uses supabase.auth.getClaims() (not getUser()) - this made page loads fast.
proxy.ts matcher excludes /api/meta-webhook (Meta cannot log in).
Theme: black dark theme is done in src/app/globals.css by overriding the Tailwind slate/white classes
(bg-white becomes dark grey, slate text becomes light). Pages still use the old class names on purpose.
Before deploy run: npm run build (passed on 24 Oct 2026; the last build output of 25 Oct was not pasted,
but the live site deployed and works).

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
There is NO tasks table, NO notifications table, NO recordings table yet.
Security (RLS) was locked down on 24 Oct 2026 with SQL, including a helper function public.is_admin():
- leads, activities, site_visits: any logged-in user can read and write.
- properties, settings: everyone can read, only admin can write.
- profiles: everyone can read, only admin can update (nobody can change their own role).

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
- src/lib/scoring.ts: calculateScore(), default SCORING_RULES, applyRules(), loads saved rules from settings
- src/lib/autoAssign.ts: pickAssignee() - gives new lead to the sales/admin person with fewest open leads
- src/lib/exportXlsx.ts: downloadXlsx() using the free exceljs package
- src/components/SmartTips.tsx: dashboard "Smart Suggestions" (rule based, no AI)
- src/components/LeadCharts.tsx: dashboard bar charts (Leads by Status / Source), pure CSS
- src/components/NextAction.tsx: "Do this now" box on lead page (rule based: call now, overdue follow-up,
  not connected, site visit steps, missing budget/purpose/timeline, no contact for 2+ days)
- src/components/WhatsAppTemplates.tsx: 6 ready WhatsApp messages (wa.me link, name + project auto-filled).
  Only opens WhatsApp; it does NOT write a timeline entry.
- src/components/CallHelper.tsx: "Before you call" box (Hinglish): opening script, 4 questions with tick
  for already-filled data, extra Meta/Instagram tip (do not ask name/number again)
- src/app/login/page.tsx: login page
- src/app/(app)/layout.tsx: sidebar (desktop) / top pills (mobile)
- src/app/(app)/page.tsx: Dashboard (8 count cards, smart tips, charts, priority leads, today's follow-ups)
- src/app/(app)/leads/page.tsx: leads list, search, filters (status/quality/source + more filters), Call and WhatsApp buttons
- src/app/(app)/leads/new/page.tsx: Add Lead (project dropdown, payment preference, interest level, duplicate -> Merge / Save anyway / Cancel, auto score, auto assign, follow-up next day 10 AM)
- src/app/(app)/leads/[id]/page.tsx: lead detail. Shows Do this now box, details (incl. Project, Payment preference,
  Interest level), WhatsApp Templates, Actions. Call button opens a FULL-SCREEN popup: Close button, Call helper,
  Start Call (tel: link), then "How did the call go?" form. Also Add Note, Set Follow-up, Change Status, Schedule Site Visit.
- src/app/(app)/leads/[id]/edit/page.tsx: edit lead details (now includes payment preference + interest level) + assign / reassign
- src/app/(app)/followups/page.tsx: Overdue / Today / Tomorrow
- src/app/(app)/site-visits/page.tsx: Missed / Today / Upcoming / Completed (Completed, Reschedule, Cancel)
- src/app/(app)/properties/page.tsx: projects list, admin-only Add/Edit buttons
- src/app/(app)/reports/page.tsx: Daily Report with Copy Report button
- src/app/(app)/settings/page.tsx: CSV Export, Excel Export, sample file, CSV Import (skips duplicate phones), link to Scoring Rules
- src/app/(app)/settings/scoring/page.tsx: admin-only scoring rules editor (Save, Recalculate all, Reset)
- src/app/api/meta-webhook/route.ts: Meta Lead Ads webhook (GET verify, POST with signature check, creates lead with service_role key).
  It only fills name, phone, email (in notes), campaign, ad set, ad. Custom form questions (budget etc.) are NOT mapped.

## Test status
Confirmed working by the owner (live site and/or phone unless noted):
  login, sidebar, dark theme, leads list, Add Lead, lead detail actions, follow-ups page, dashboard (also on phone),
  properties add/edit, reports page opens, CSV export, Excel export, Vercel deploy, Meta webhook GET verification,
  Site Visits buttons (Reschedule, Completed, Cancel), CSV Import (new lead added) and duplicate skip,
  mobile (phone, crm1): Dashboard, Leads, Add Lead, Site Visits,
  Edit Lead payment preference + interest level, lead detail Project / Payment / Interest (local and live),
  Do this now box (local and live phone), WhatsApp Templates (live phone),
  Call popup flow incl. Call helper, Meta tip, Hinglish script, Start Call (local and live phone).
Code written and passes tsc, but NOT specifically confirmed by the owner:
  project dropdown on Add Lead, Reassign on Edit Lead, auto assign, Smart Suggestions box, dashboard charts,
  WhatsApp button on the leads list, Scoring Rules screen (save / recalculate / admin-only), More filters on leads list,
  Merge duplicate, payment preference and interest level on Add Lead.
NOT tested at all: logged-out redirect to /login on the live site, the RLS rules with a sales (crm2) account,
  Copy Report text, phone layout of Follow-ups / Reports / Settings pages, the Meta webhook POST (needs a real Meta app),
  Call helper with real Meta data.

## Known gaps (do these next, in this order)
1. Finish testing the "NOT specifically confirmed" and "NOT tested" items above, one by one. Fix bugs.
2. Dashboard redesign (owner pasted a long brief on 25 Oct; follow it in small steps). Rules for it:
   first only inspect src/app/(app)/page.tsx and the layout; keep the dark theme; every number must come from
   real data; no fake buttons; do not break auth/RLS/webhook. Idea: "Today's Priority" section (leads to call,
   follow-ups due, overdue, site visits today, leads going cold) with a clear button on each item, lead health
   (Best/Good/Medium/Poor), sales pipeline, top priority leads, quick actions that already exist.
   Tasks, Notifications and Employee workload need new tables first - do NOT fake them.
3. Roles (Admin vs Employee dashboards): must be enforced with Supabase RLS, not only in the UI. Design first.
4. Call recording (free idea only): employee records with the phone's own recorder, then uploads the file to the
   lead timeline using Supabase free storage. NOT built. Needs a consent line (customer must be told about recording).
   Auto-recording from the browser is not possible for free.
5. Meta Lead Ads setup (owner has a Facebook Page but no ads or Meta developer app yet): create Meta app,
   subscribe the webhook to the leadgen field with the verify token, set META_APP_SECRET and META_PAGE_ACCESS_TOKEN
   in Vercel, redeploy, test with Meta's Lead Ads Testing Tool. Then map custom form fields (budget, location)
   once the real field names are known.
6. Daily report by free email or free scheduled job (design only first): Vercel cron free plan + free email tier,
   or a "Copy report for WhatsApp" flow.
7. Free AI helper (lead summary / next action). Only a genuinely free API tier, explain the data-privacy tradeoff first,
   keep it optional. Rule-based Smart Suggestions and Do this now already exist.
8. Other ideas for the boss demo: leaderboard (site visits per employee), lead aging alert, weekly summary for boss,
   log a timeline entry when a WhatsApp template is used.
9. Mobile polish and premium look: animations, nicer cards, check more pages on a real phone.
10. Cleanup: the Next.js dev warning about npm audit is ignored on purpose; do not run npm audit fix blindly.

## Market note (from general knowledge, not searched)
Bigger paid CRMs: Sell.Do, LeadSquared, Zoho CRM, HubSpot, Salesforce. Our edge is simplicity, mobile use and zero cost.