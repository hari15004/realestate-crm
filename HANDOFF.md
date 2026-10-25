# Real Estate CRM - Handoff Notes
Last updated: 25 Oct 2026

## Goal
Simple, free, mobile-friendly CRM for a small Indian real-estate sales team.
Journey: Lead -> call -> follow-up -> site visit -> negotiation -> booked/sold OR lost.
Not enterprise. A new employee must understand it in 5 minutes. Owner wants a premium, high-tech look
like his reference image (dark navy, sidebar icons, tabs, cards), with ONLY real data.

## Owner and working rules (follow exactly)
- Owner (Jams) is a complete beginner. Chats in Hinglish, reply in Hinglish. ALL app/UI text in ENGLISH
  (exception: customer-facing Call helper script is Hinglish).
- Keep replies VERY SHORT, fewer tokens. ONE step at a time. Owner pastes output back.
- Files over ~50 lines: `code <path>`, Ctrl+A, paste, Ctrl+S. Small edits: python3 replace script that prints
  PATCHED / NOT_PATCHED (preferred) or exact sed. Heredoc pastes of long files have failed before.
- ONE combined check per change (wc -l/grep + `npx tsc --noEmit`). No heavy testing.
- Everything FREE. No paid APIs. No fake features or fake data.
- Never put service_role key or secrets in chat/frontend. .env.local is git-ignored.
- Only say "working" if owner confirmed. If owner only says "done" without output, say output was not seen.
- Do not rewrite what works. Linux laptop; tel: opens KDE Connect.
- Owner wants the whole CRM to look like the reference image, page by page.

## Stack and hosting
Next.js 16 (App Router, TS, Tailwind v4), Supabase free (Mumbai). Folder ~/Desktop/realestate-crm.
Run: npm run dev. GitHub private: hari15004/realestate-crm (main). Live: https://realestate-crm-self.vercel.app (auto deploy on push).
Env (local + Vercel): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Vercel-only: META_VERIFY_TOKEN,
SUPABASE_SERVICE_ROLE_KEY. Not set yet: META_APP_SECRET, META_PAGE_ACCESS_TOKEN. Redeploy after env change.
Accounts: crm1 (admin), crm2 (sales). Sign-ups OFF. Roles in profiles table.
Middleware file is src/proxy.ts (getClaims), matcher excludes /api/meta-webhook.
Last build: compiled OK on 25 Oct 2026 (commit 516d90a).

## Design system
- src/app/globals.css: old overrides (bg-white, slate-*) kept so un-restyled pages stay dark. New tokens in @theme:
  canvas #0a1020, surface #0f1a30, surface-2 #14233f, line #1e2f52, muted, accent, accent-soft, success, danger, warn,
  violet (+ -soft). Class .ui-focus for focus ring. body font is still Arial (Geist loaded but unused).
- src/components/ui.tsx: Card, Button, ButtonLink, Badge, QualityBadge, StatusPill, SectionHeader, EmptyState, Loading.
- Icons are inline SVG (no icon package). Pattern for new pages: rounded-xl border border-line bg-surface, initial circle,
  QualityBadge/StatusPill, tabs with aria-selected.

## Database tables
profiles(id, full_name, role admin/sales/marketing), properties(id, name, location, property_type, starting_price,
available_units, status), leads(lead_no, name, phone, alt_phone, source, campaign, ad_set, ad, property_id, property_type,
location, preferred_location, budget, payment_preference, purpose, timeline, status, score, quality, interest_level,
assigned_to, next_followup_at, followup_type, followup_note, call_attempts, last_call_status, notes),
activities(lead_id, type, detail, call_result, done_by, created_at), site_visits(lead_id, property_id, visit_at,
assigned_to, status, notes), settings(key, value jsonb; 'scoring').
NO tasks, notifications or recordings tables. RLS: leads/activities/site_visits any logged-in user; properties/settings
read all, admin write; profiles read all, admin update (public.is_admin()).

## App values
Statuses: New, Contacted, Interested, Follow-up, Site Visit Planned, Site Visit Done, Negotiation, Booked, Sold,
Not Interested, Lost. Closed: Booked, Sold, Not Interested, Lost. Quality: Best 70+, Good 45+, Medium 25+, Poor.
Sources: Meta, Instagram, Website, WhatsApp, Referral, Phone, Other. Visit statuses: Planned, Completed, Cancelled, Rescheduled.

## Files
- src/components: ui.tsx, TodayPriority (greeting + priority cards), LeadCharts (Sales Pipeline bars, Lead Health, by Status/Source),
  RecentActivity, SmartTips, NextAction ("Do this now"), WhatsAppTemplates (6 wa.me templates), CallHelper (Hinglish),
  DataTools (CSV/Excel export + CSV import, shown on Reports).
- src/lib: supabase/client+server, scoring.ts, autoAssign.ts, exportXlsx.ts.
- (app)/layout.tsx: sidebar with icons, groups Workspace/Business/System, name+role, mobile pills.
- (app)/page.tsx: Dashboard = greeting+Today's Priority, SmartTips, 6 KPI cards (Active, New Today, Best, Due Today,
  Site Visits Today, Won), LeadCharts, RecentActivity, Top Priority Leads rows, Today's Follow-ups, Quick Actions (Add Lead, Import Leads -> /settings is WRONG now: import moved to /reports, fix link).
- leads/page.tsx (restyled), leads/new (OLD look), leads/[id] (OLD look; has Do this now, WhatsApp Templates, Call popup),
  leads/[id]/edit (OLD look), followups (tabs: All/Overdue/Today/Tomorrow), site-visits (tabs), properties (card grid, no photos;
  add/edit form OLD look), reports (Daily Report 2-col cards + Copy Report + DataTools), settings (Account + Scoring Rules link),
  settings/scoring (OLD look), login (OLD look).
- api/meta-webhook/route.ts: fills name, phone, email, campaign, ad set, ad only.
- Call buttons on Dashboard, Leads, Follow-ups link to /leads/[id]?call=1; lead page auto-opens the full-screen Call popup
  (Close, Call helper, Start Call tel: link, then call result form).

## Test status
Confirmed by owner (earlier): login, leads, add lead, lead actions, follow-ups, site visit buttons (old look), CSV import/export (old place),
mobile on 4 pages, Edit lead fields, Do this now, WhatsApp templates, Call popup (live phone), Dashboard redesign (live phone).
Local "looks fine" only (not live, output often not pasted): restyled Leads, Follow-ups tabs, Site Visits tabs, Properties grid,
Reports cards, Settings Account.
UNTESTED: live phone for those restyled pages; site visit buttons in new look; Export/Import at new Reports location;
Copy Report text; Scoring Rules screen; Leads filter panel restyle; crm2 RLS; logged-out redirect on live; Meta webhook POST.

## Next steps (in order)
1. Fix Dashboard Quick Actions "Import Leads" link (should go to /reports).
2. Restyle Lead detail page (keep Do this now, WhatsApp, Call popup), then Add Lead, Edit Lead, scoring page, login, properties form.
3. Test everything above on live phone.
4. Not possible yet (need tables/design): notifications, search, tasks, workload, trends, leads going cold, property photos.
5. Admin vs Employee dashboards: design roles + RLS first, never UI-only.
6. Later: Meta Lead Ads setup, free daily report, call recording upload (consent needed), optional free AI helper, Geist font.
7. Do not run npm audit fix blindly.