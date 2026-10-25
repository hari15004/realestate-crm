'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import SmartTips from '@/components/SmartTips'
import LeadCharts from '@/components/LeadCharts'
import TodayPriority from '@/components/TodayPriority'

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
}

const cols =
  'id, lead_no, name, phone, status, quality, score, next_followup_at, followup_type, followup_note'

function Card({
  label, value, href, tone,
}: { label: string; value: number; href: string; tone: 'blue' | 'green' | 'red' | 'slate' }) {
  const color =
    tone === 'red' ? 'text-red-600'
    : tone === 'green' ? 'text-green-700'
    : tone === 'blue' ? 'text-blue-700'
    : 'text-slate-800'
  return (
    <Link href={href} className="bg-white rounded-2xl shadow p-4 block">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={'text-3xl font-bold mt-1 ' + color}>{value}</p>
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
      setPriority((p.data ?? []) as LeadRow[])
      setTodayList((t.data ?? []) as LeadRow[])
    }
    load()
  }, [])

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">Dashboard</span>
        <Link href="/leads/new" className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold">
          + Add Lead
        </Link>
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {!counts && !error && <p className="text-slate-500">Loading...</p>}

      {counts && (
        <>
          <TodayPriority overdue={counts.overdue} dueToday={counts.dueToday} visitsToday={counts.visitsToday} hot={counts.hot} newToday={counts.newToday} />
          <SmartTips />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <Card label="New Leads Today" value={counts.newToday} href="/leads" tone="blue" />
            <Card label="Active Leads" value={counts.active} href="/leads" tone="slate" />
            <Card label="Hot Leads" value={counts.hot} href="/leads" tone="green" />
            <Card label="Follow-ups Due Today" value={counts.dueToday} href="/followups" tone="blue" />
            <Card label="Overdue Follow-ups" value={counts.overdue} href="/followups" tone="red" />
            <Card label="Site Visits Today" value={counts.visitsToday} href="/site-visits" tone="blue" />
            <Card label="Bookings" value={counts.bookings} href="/leads" tone="green" />
            <Card label="Lost Leads" value={counts.lost} href="/leads" tone="slate" />
          </div>

          <LeadCharts />
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Today&apos;s Priority Leads</h2>
          {priority.length === 0 && <p className="text-slate-500 mb-8">No active leads yet.</p>}
          <div className="space-y-3 mb-8">
            {priority.map((l) => (
              <div key={l.id} className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={'/leads/' + l.id} className="text-lg font-semibold text-slate-800">
                      {l.name}
                    </Link>
                    <p className="text-sm text-slate-500">
                      #{l.lead_no} · {l.phone} · {l.status}
                    </p>
                  </div>
                  <span className={'rounded-full px-3 py-1 text-sm font-medium ' + (qualityColor[l.quality] ?? '')}>
                    {l.quality} ({l.score})
                  </span>
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

          <h2 className="text-lg font-semibold text-slate-800 mb-3">Today&apos;s Follow-ups</h2>
          {todayList.length === 0 && <p className="text-slate-500">No follow-ups planned for today.</p>}
          <div className="space-y-3">
            {todayList.map((l) => {
              const late = l.next_followup_at && new Date(l.next_followup_at) < new Date()
              return (
                <div key={l.id} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={'/leads/' + l.id} className="text-lg font-semibold text-slate-800">
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
