'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SmartTips from '@/components/SmartTips'
import LeadCharts from '@/components/LeadCharts'
import RecentActivity from '@/components/RecentActivity'
import TodayPriority from '@/components/TodayPriority'
import { QualityBadge, StatusPill } from '@/components/ui'

const supabase = createClient()

const closed = '(Booked,Sold,Not Interested,Lost)'

const qualityColor: Record<string, string> = {
  Best: 'bg-green-100 text-green-800',
  Good: 'bg-blue-100 text-blue-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Poor: 'bg-slate-200 text-slate-700',
}

type Counts = {
  newToday: number
  active: number
  hot: number
  dueToday: number
  overdue: number
  visitsToday: number
  bookings: number
  lost: number
}

type LeadRow = {
  id: string
  lead_no: number
  name: string
  phone: string
  status: string
  quality: string
  score: number
  next_followup_at: string | null
  followup_type: string | null
  followup_note: string | null
  budget: number | null
  property_id: string | null
  last_call_status: string | null
}

const cols =
  'id, lead_no, name, phone, status, quality, score, next_followup_at, followup_type, followup_note, budget, property_id, last_call_status'

const kpiIcons: Record<string, string> = {
  'Active Leads': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'New Today': 'M12 5v14M5 12h14',
  'Best Leads': 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  'Due Today': 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  'Site Visits Today': 'M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  'Won (Booked/Sold)': 'M20 6L9 17l-5-5',
}

function Card({
  label, value, href, tone,
}: { label: string; value: number; href: string; tone: 'blue' | 'green' | 'red' | 'slate' }) {
  const color =
    tone === 'red' ? 'text-danger'
    : tone === 'green' ? 'text-success'
    : tone === 'blue' ? 'text-accent'
    : 'text-slate-100'
  return (
    <Link href={href} className="ui-focus group flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:bg-surface-2">
      <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 ' + color}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
          <path d={kpiIcons[label] ?? 'M12 5v14M5 12h14'} />
        </svg>
      </span>
      <span>
        <span className="block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className={'block text-2xl font-bold ' + color}>{value}</span>
      </span>
    </Link>
  )
}

function formatTime(d: string) {
  return new Date(d).toLocaleString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export default function DashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [priority, setPriority] = useState<LeadRow[]>([])
  const [todayList, setTodayList] = useState<LeadRow[]>([])
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<Record<string, string>>({})
  const detail = (l: LeadRow) => {
    const parts: string[] = []
    if (l.property_id && projects[l.property_id]) parts.push(projects[l.property_id])
    if (l.budget) parts.push('Budget ' + (l.budget >= 10000000 ? (l.budget / 10000000).toFixed(2) + ' Cr' : (l.budget / 100000).toFixed(1) + ' L'))
    if (l.last_call_status) parts.push('Last call: ' + l.last_call_status)
    return parts.length ? ' · ' + parts.join(' · ') : ''
  }

  useEffect(() => {
    async function load() {
      const now = new Date()
      const startToday = new Date()
      startToday.setHours(0, 0, 0, 0)
      const startTomorrow = new Date(startToday)
      startTomorrow.setDate(startTomorrow.getDate() + 1)

      const nowIso = now.toISOString()
      const todayIso = startToday.toISOString()
      const tomorrowIso = startTomorrow.toISOString()

      const base = () => supabase.from('leads').select('id', { count: 'exact', head: true })
      const active = () => base().not('status', 'in', closed)

      const [a, b, c, d, e, f, g, h, p, t] = await Promise.all([
        base().gte('created_at', todayIso),
        active(),
        active().eq('quality', 'Best'),
        active().gte('next_followup_at', nowIso).lt('next_followup_at', tomorrowIso),
        active().lt('next_followup_at', nowIso),
        supabase.from('site_visits').select('id', { count: 'exact', head: true })
          .in('status', ['Planned', 'Rescheduled'])
          .gte('visit_at', todayIso).lt('visit_at', tomorrowIso),
        base().in('status', ['Booked', 'Sold']),
        base().in('status', ['Not Interested', 'Lost']),
        supabase.from('leads').select(cols)
          .not('status', 'in', closed)
          .order('score', { ascending: false })
          .limit(5),
        supabase.from('leads').select(cols)
          .not('status', 'in', closed)
          .gte('next_followup_at', todayIso).lt('next_followup_at', tomorrowIso)
          .order('next_followup_at', { ascending: true })
          .limit(10),
      ])

      const failed = [a, b, c, d, e, f, g, h, p, t].find((r) => r.error)
      if (failed && failed.error) {
        setError('Could not load the dashboard: ' + failed.error.message)
        return
      }

      setCounts({
        newToday: a.count ?? 0,
        active: b.count ?? 0,
        hot: c.count ?? 0,
        dueToday: d.count ?? 0,
        overdue: e.count ?? 0,
        visitsToday: f.count ?? 0,
        bookings: g.count ?? 0,
        lost: h.count ?? 0,
      })
      const { data: pr } = await supabase.from('properties').select('id, name')
      const m: Record<string, string> = {}
      ;(pr ?? []).forEach((x) => { m[x.id as string] = x.name as string })
      setProjects(m)
      setPriority((p.data ?? []) as LeadRow[])
      setTodayList((t.data ?? []) as LeadRow[])
    }
    load()
  }, [])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dashboard</span>
        <div className="flex gap-2">
          <Link href="/leads/new" className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold">
            + Add Lead
          </Link>
          <Link href="/settings" className="bg-slate-100 text-slate-800 rounded-xl px-4 py-3 font-semibold">
            Import Leads
          </Link>
        </div>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {!counts && !error && <p className="text-slate-500">Loading...</p>}

      {counts && (
        <>
          <TodayPriority overdue={counts.overdue} dueToday={counts.dueToday} visitsToday={counts.visitsToday} hot={counts.hot} newToday={counts.newToday} />
          <SmartTips />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
            <Card label="Active Leads" value={counts.active} href="/leads" tone="slate" />
            <Card label="New Today" value={counts.newToday} href="/leads" tone="blue" />
            <Card label="Best Leads" value={counts.hot} href="/leads" tone="green" />
            <Card label="Due Today" value={counts.dueToday} href="/followups" tone="blue" />
            <Card label="Site Visits Today" value={counts.visitsToday} href="/site-visits" tone="blue" />
            <Card label="Won (Booked/Sold)" value={counts.bookings} href="/leads" tone="green" />
          </div>

          <LeadCharts />
          <RecentActivity />
          <section className="mb-8 rounded-xl border border-line bg-surface shadow-sm shadow-black/20" aria-label="Top priority leads">
            <div className="border-b border-line p-4">
              <h2 className="text-base font-semibold text-slate-100">Top Priority Leads</h2>
              <p className="text-sm text-muted">Highest score active leads</p>
            </div>
            {priority.length === 0 && <p className="p-4 text-sm text-muted">No active leads yet.</p>}
            <ul className="divide-y divide-line">
              {priority.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-surface-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-blue-300" aria-hidden="true">
                    {(l.name || '?').charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <Link href={'/leads/' + l.id} className="ui-focus block truncate text-base font-semibold text-slate-100">{l.name}</Link>
                    <p className="truncate text-sm text-muted">#{l.lead_no} · {l.phone}{detail(l)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <QualityBadge quality={l.quality} score={l.score} />
                    <StatusPill status={l.status} />
                  </div>
                  <a href={'/leads/' + l.id + '?call=1'} className="ui-focus inline-flex items-center justify-center rounded-lg bg-success px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-green-400">Call</a>
                </li>
              ))}
            </ul>
          </section>

          <h2 className="mb-3 text-base font-semibold text-slate-100">Today&apos;s Follow-ups</h2>
          {todayList.length === 0 && <p className="text-slate-500">No follow-ups planned for today.</p>}
          <div className="space-y-3">
            {todayList.map((l) => {
              const late = l.next_followup_at && new Date(l.next_followup_at) < new Date()
              return (
                <div key={l.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20 transition-colors hover:bg-surface-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={'/leads/' + l.id} className="ui-focus text-base font-semibold text-slate-100">
                        {l.name}
                      </Link>
                      <p className="text-sm text-slate-600">
                        <b>{l.followup_type ?? 'Call'}</b>
                        {l.followup_note ? ' - ' + l.followup_note : ''}
                      </p>
                    </div>
                    {l.next_followup_at && (
                      <span className={'text-sm font-medium whitespace-nowrap ' + (late ? 'text-red-600' : 'text-slate-700')}>
                        {late ? 'Overdue ' : ''}
                        {formatTime(l.next_followup_at)}
                      </span>
                    )}
                  </div>
                  <a
                    href={'/leads/' + l.id + '?call=1'}
                    className="mt-3 block text-center bg-green-600 text-white rounded-xl py-3 font-semibold"
                  >
                    Call
                  </a>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
