'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SmartTips from '@/components/SmartTips'
import LeadCharts from '@/components/LeadCharts'
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

function Card({
  label, value, href, tone,
}: { label: string; value: number; href: string; tone: 'blue' | 'green' | 'red' | 'slate' }) {
  const color =
    tone === 'red' ? 'text-danger'
    : tone === 'green' ? 'text-success'
    : tone === 'blue' ? 'text-accent'
    : 'text-slate-100'
  return (
    <Link href={href} className="ui-focus block rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20 transition-colors hover:bg-surface-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={'mt-1 text-3xl font-bold ' + color}>{value}</p>
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
          <h2 className="mb-3 text-base font-semibold text-slate-100">Today&apos;s Priority Leads</h2>
          {priority.length === 0 && <p className="text-slate-500 mb-8">No active leads yet.</p>}
          <div className="space-y-3 mb-8">
            {priority.map((l) => (
              <div key={l.id} className="rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20 transition-colors hover:bg-surface-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={'/leads/' + l.id} className="ui-focus text-base font-semibold text-slate-100">
                      {l.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      #{l.lead_no} · {l.phone}{detail(l)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <QualityBadge quality={l.quality} score={l.score} />
                    <StatusPill status={l.status} />
                  </div>
                </div>
                <a
                  href={'tel:' + l.phone}
                  className="mt-3 block text-center bg-green-600 text-white rounded-xl py-3 font-semibold"
                >
                  Call
                </a>
              </div>
            ))}
          </div>

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
                    href={'tel:' + l.phone}
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
