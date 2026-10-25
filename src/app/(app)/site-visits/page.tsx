'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calculateScore } from '@/lib/scoring'

const supabase = createClient()

const activeStatuses = ['Planned', 'Rescheduled']
const beforeVisitStatuses = ['New', 'Contacted', 'Interested', 'Follow-up', 'Site Visit Planned']

type LeadInfo = {
  id: string
  lead_no: number
  name: string
  phone: string
  status: string
  budget: number | null
  property_id: string | null
  property_type: string | null
  location: string | null
  preferred_location: string | null
  purpose: string | null
  timeline: string | null
  call_attempts: number | null
  last_call_status: string | null
}

type Visit = {
  id: string
  lead_id: string
  visit_at: string
  status: string
  notes: string | null
  leads: LeadInfo | null
  properties: { name: string } | null
  profiles: { full_name: string | null } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

const statusColor: Record<string, string> = {
  Planned: 'bg-blue-100 text-blue-800',
  Rescheduled: 'bg-yellow-100 text-yellow-800',
  Completed: 'bg-green-100 text-green-800',
  Cancelled: 'bg-slate-200 text-slate-700',
}

export default function SiteVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [reschedId, setReschedId] = useState('')
  const [reschedAt, setReschedAt] = useState('')
  const [tab, setTab] = useState<'all' | 'missed' | 'today' | 'upcoming' | 'closed'>('all')

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('site_visits')
      .select(
        'id, lead_id, visit_at, status, notes, ' +
          'leads(id, lead_no, name, phone, status, budget, property_id, property_type, location, preferred_location, purpose, timeline, call_attempts, last_call_status), ' +
          'properties(name), profiles(full_name)'
      )
      .order('visit_at', { ascending: true })
      .limit(300)
    if (err) setError('Could not load site visits: ' + err.message)
    else {
      setError('')
      setVisits((data ?? []) as unknown as Visit[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function updateVisit(v: Visit, status: string, newTime?: string) {
    setBusyId(v.id)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const changes: { status: string; visit_at?: string } = { status }
      if (newTime) changes.visit_at = newTime
      const r = await supabase.from('site_visits').update(changes).eq('id', v.id)
      if (r.error) throw new Error(r.error.message)

      const lead = v.leads
      let newLeadStatus = ''
      let type = ''
      let detail = ''

      if (status === 'Completed') {
        type = 'Site visit completed'
        if (lead && beforeVisitStatuses.includes(lead.status)) newLeadStatus = 'Site Visit Done'
      } else if (status === 'Cancelled') {
        type = 'Site visit cancelled'
        if (lead && lead.status === 'Site Visit Planned') newLeadStatus = 'Interested'
      } else if (status === 'Rescheduled') {
        type = 'Site visit rescheduled'
        detail = 'New time: ' + formatDate(newTime ?? v.visit_at)
      }

      if (lead && newLeadStatus) {
        const merged = { ...lead, status: newLeadStatus }
        const { score, quality } = calculateScore(merged)
        const lr = await supabase
          .from('leads')
          .update({ status: newLeadStatus, score, quality })
          .eq('id', lead.id)
        if (lr.error) throw new Error(lr.error.message)
        detail = (detail ? detail + '. ' : '') + 'Lead status is now ' + newLeadStatus
      }

      const ar = await supabase.from('activities').insert({
        lead_id: v.lead_id,
        type,
        detail: detail || null,
        done_by: user?.id ?? null,
      })
      if (ar.error) throw new Error(ar.error.message)

      setReschedId('')
      setReschedAt('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
    setBusyId('')
  }

  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)
  const startTomorrow = new Date(startToday)
  startTomorrow.setDate(startTomorrow.getDate() + 1)

  const active = visits.filter((v) => activeStatuses.includes(v.status))
  const missed = active.filter((v) => new Date(v.visit_at) < startToday)
  const today = active.filter((v) => {
    const t = new Date(v.visit_at)
    return t >= startToday && t < startTomorrow
  })
  const upcoming = active.filter((v) => new Date(v.visit_at) >= startTomorrow)
  const closed = visits
    .filter((v) => !activeStatuses.includes(v.status))
    .sort((a, b) => b.visit_at.localeCompare(a.visit_at))
    .slice(0, 20)

  const tabs = [
    { key: 'all', label: 'All', list: [...missed, ...today, ...upcoming] },
    { key: 'missed', label: 'Missed', list: missed },
    { key: 'today', label: 'Today', list: today },
    { key: 'upcoming', label: 'Upcoming', list: upcoming },
    { key: 'closed', label: 'Completed / Cancelled', list: closed },
  ] as const
  const shown = (tabs.find((t) => t.key === tab) ?? tabs[0]).list

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-100">Site Visits</h1>
      <p className="mb-4 text-sm text-muted">To plan a new visit, open a lead and tap Schedule Site Visit.</p>

      {error && <p className="mb-3 text-danger">{error}</p>}
      {loading && <p className="text-muted">Loading...</p>}

      {!loading && (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={
                  'ui-focus whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ' +
                  (tab === t.key
                    ? 'bg-accent text-white'
                    : 'border border-line bg-surface text-slate-300 hover:bg-surface-2')
                }
              >
                {t.label} <span className={t.key === 'missed' && t.list.length > 0 ? 'text-red-300' : 'opacity-70'}>({t.list.length})</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-line bg-surface shadow-sm shadow-black/20">
            {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No site visits here.</p>}
            <ul className="divide-y divide-line">
              {shown.map((v) => {
                const isActive = activeStatuses.includes(v.status)
                const busy = busyId === v.id
                const isMissed = isActive && new Date(v.visit_at) < startToday
                return (
                  <li key={v.id} className="p-4 transition-colors hover:bg-surface-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-blue-300" aria-hidden="true">
                        {(v.leads?.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1 basis-48">
                        <Link href={'/leads/' + v.lead_id} className="ui-focus block truncate text-base font-semibold text-slate-100">
                          {v.leads?.name ?? 'Unknown lead'}
                        </Link>
                        <p className="truncate text-sm text-muted">
                          #{v.leads?.lead_no} · {v.leads?.phone} · {v.properties?.name ?? 'No project'} · {v.profiles?.full_name ?? 'Unassigned'}
                        </p>
                        {v.notes && <p className="truncate text-xs text-muted">Notes: {v.notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={'whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ' + (isMissed ? 'border-red-900 bg-danger-soft text-red-300' : 'border-blue-900 bg-accent-soft text-blue-300')}>
                          {formatDate(v.visit_at)}
                        </span>
                        <span className={'rounded-full border px-2.5 py-0.5 text-xs font-medium ' + (v.status === 'Completed' ? 'border-green-900 bg-success-soft text-green-300' : v.status === 'Cancelled' ? 'border-line bg-surface-2 text-slate-300' : v.status === 'Rescheduled' ? 'border-amber-900 bg-warn-soft text-amber-300' : 'border-blue-900 bg-accent-soft text-blue-300')}>
                          {v.status}
                        </span>
                      </div>
                    </div>

                    {isActive && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          disabled={busy}
                          onClick={() => updateVisit(v, 'Completed')}
                          className="ui-focus rounded-lg bg-success px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-green-400 disabled:opacity-60"
                        >
                          Completed
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setReschedId(reschedId === v.id ? '' : v.id)
                            setReschedAt('')
                          }}
                          className="ui-focus rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-line disabled:opacity-60"
                        >
                          Reschedule
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => updateVisit(v, 'Cancelled')}
                          className="ui-focus rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-red-400 transition-colors hover:bg-line disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {isActive && reschedId === v.id && (
                      <div className="mt-3 space-y-2">
                        <input
                          type="datetime-local"
                          value={reschedAt}
                          onChange={(e) => setReschedAt(e.target.value)}
                          className="ui-focus w-full rounded-lg border border-line bg-surface-2 px-4 py-3 text-base text-slate-100"
                        />
                        <button
                          disabled={busy || !reschedAt}
                          onClick={() => updateVisit(v, 'Rescheduled', new Date(reschedAt).toISOString())}
                          className="ui-focus w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                        >
                          {busy ? 'Saving...' : 'Save New Time'}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
