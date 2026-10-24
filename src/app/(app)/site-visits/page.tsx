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

  function renderGroup(
    title: string,
    list: Visit[],
    tone: 'red' | 'blue' | 'slate' | 'green',
    empty: string
  ) {
    const heading =
      tone === 'red' ? 'text-red-600'
      : tone === 'blue' ? 'text-blue-700'
      : tone === 'green' ? 'text-green-700'
      : 'text-slate-700'
    const border =
      tone === 'red' ? 'border-red-400'
      : tone === 'blue' ? 'border-blue-400'
      : tone === 'green' ? 'border-green-400'
      : 'border-slate-300'

    return (
      <section className="mb-8">
        <h2 className={'text-lg font-semibold mb-3 ' + heading}>
          {title} ({list.length})
        </h2>
        {list.length === 0 && <p className="text-slate-500">{empty}</p>}
        <div className="space-y-3">
          {list.map((v) => {
            const isActive = activeStatuses.includes(v.status)
            const busy = busyId === v.id
            return (
              <div key={v.id} className={'bg-white rounded-2xl shadow p-4 border-l-4 ' + border}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={'/leads/' + v.lead_id} className="text-lg font-semibold text-slate-800">
                      {v.leads?.name ?? 'Unknown lead'}
                    </Link>
                    <p className="text-sm text-slate-500">
                      #{v.leads?.lead_no} · {v.leads?.phone}
                    </p>
                  </div>
                  <span className={'rounded-full px-3 py-1 text-sm font-medium ' + (statusColor[v.status] ?? '')}>
                    {v.status}
                  </span>
                </div>

                <div className="mt-2 text-sm text-slate-600 space-y-1">
                  <p>When: <b>{formatDate(v.visit_at)}</b></p>
                  <p>Project: <b>{v.properties?.name ?? '-'}</b></p>
                  <p>Assigned to: <b>{v.profiles?.full_name ?? 'Unassigned'}</b></p>
                  {v.notes && <p>Notes: {v.notes}</p>}
                </div>

                {isActive && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button
                      disabled={busy}
                      onClick={() => updateVisit(v, 'Completed')}
                      className="bg-green-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60"
                    >
                      Completed
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setReschedId(reschedId === v.id ? '' : v.id)
                        setReschedAt('')
                      }}
                      className="bg-slate-100 text-slate-800 rounded-xl py-3 font-semibold disabled:opacity-60"
                    >
                      Reschedule
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => updateVisit(v, 'Cancelled')}
                      className="bg-slate-100 text-red-600 rounded-xl py-3 font-semibold disabled:opacity-60"
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
                      className="w-full border rounded-xl px-4 py-3 text-base bg-white"
                    />
                    <button
                      disabled={busy || !reschedAt}
                      onClick={() => updateVisit(v, 'Rescheduled', new Date(reschedAt).toISOString())}
                      className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60"
                    >
                      {busy ? 'Saving...' : 'Save New Time'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Site Visits</h1>
      <p className="text-slate-500 mb-4">
        To plan a new visit, open a lead and tap Schedule Site Visit.
      </p>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && (
        <>
          {renderGroup('Missed - please update', missed, 'red', 'No missed visits.')}
          {renderGroup('Today', today, 'blue', 'No site visits today.')}
          {renderGroup('Upcoming', upcoming, 'slate', 'No upcoming site visits.')}
          {renderGroup('Completed / Cancelled', closed, 'green', 'Nothing here yet.')}
        </>
      )}
    </div>
  )
}
