'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import NextAction from '@/components/NextAction'
import WhatsAppTemplates from '@/components/WhatsAppTemplates'
import CallHelper from '@/components/CallHelper'
import { QualityBadge, StatusPill } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'
import { calculateScore } from '@/lib/scoring'

const supabase = createClient()

const statuses = [
  'New', 'Contacted', 'Interested', 'Follow-up', 'Site Visit Planned',
  'Site Visit Done', 'Negotiation', 'Booked', 'Sold', 'Not Interested', 'Lost',
]
const callResults = ['Connected', 'Not connected', 'Call back requested', 'Invalid number']
const followupTypes = ['Call', 'WhatsApp', 'Site visit', 'Meeting', 'Other']
const closedStatuses = ['Booked', 'Sold', 'Not Interested', 'Lost']
const earlyStatuses = ['New', 'Contacted', 'Interested', 'Follow-up']

const qualityColor: Record<string, string> = {
  Best: 'bg-green-100 text-green-800',
  Good: 'bg-blue-100 text-blue-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Poor: 'bg-slate-200 text-slate-700',
}

type Lead = {
  id: string
  lead_no: number
  name: string
  phone: string
  alt_phone: string | null
  source: string
  campaign: string | null
  ad_set: string | null
  ad: string | null
  property_id: string | null
  payment_preference: string | null
  interest_level: string | null
  property_type: string | null
  location: string | null
  preferred_location: string | null
  budget: number | null
  purpose: string | null
  timeline: string | null
  status: string
  score: number
  quality: string
  assigned_to: string | null
  next_followup_at: string | null
  followup_type: string | null
  followup_note: string | null
  call_attempts: number | null
  last_call_status: string | null
  notes: string | null
}

type Activity = {
  id: string
  type: string
  detail: string | null
  call_result: string | null
  created_at: string
  done_by: string | null
}

type Panel = 'call' | 'note' | 'followup' | 'status' | 'visit' | null

const box = 'w-full border rounded-xl px-4 py-3 text-base bg-white'

function formatBudget(n: number | null) {
  if (!n) return '-'
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + ' L'
  return '₹' + n
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base text-slate-800">{value || '-'}</p>
    </div>
  )
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [people, setPeople] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [projectName, setProjectName] = useState('')

  const [callResult, setCallResult] = useState('Connected')
  const [callNote, setCallNote] = useState('')
  const [noteText, setNoteText] = useState('')
  const [fuAt, setFuAt] = useState('')
  const [fuType, setFuType] = useState('Call')
  const [fuNote, setFuNote] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [visitAt, setVisitAt] = useState('')
  const [visitNote, setVisitNote] = useState('')

  const load = useCallback(async () => {
    const [l, a, p] = await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase
        .from('activities')
        .select('id, type, detail, call_result, created_at, done_by')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name'),
    ])
    if (l.error) {
      setError('Could not load this lead: ' + l.error.message)
      return
    }
    setLead(l.data as Lead)
    if (new URLSearchParams(window.location.search).get('call') === '1') {
      setPanel('call')
      window.history.replaceState(null, '', window.location.pathname)
    }
    const pid = (l.data as Lead).property_id
    if (pid) {
      const { data: pr } = await supabase.from('properties').select('name').eq('id', pid).single()
      setProjectName(pr?.name ?? '')
    } else setProjectName('')
    setActivities((a.data ?? []) as Activity[])
    const map: Record<string, string> = {}
    ;(p.data ?? []).forEach((x) => {
      map[x.id] = x.full_name ?? 'Unknown'
    })
    setPeople(map)
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function addActivity(type: string, detail: string | null, callRes?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('activities').insert({
      lead_id: id,
      type,
      detail,
      call_result: callRes ?? null,
      done_by: user?.id ?? null,
    })
    if (err) throw new Error(err.message)
  }

  async function updateLead(changes: Partial<Lead>) {
    if (!lead) return
    const merged = { ...lead, ...changes }
    const { score, quality } = calculateScore(merged)
    const { error: err } = await supabase
      .from('leads')
      .update({ ...changes, score, quality })
      .eq('id', id)
    if (err) throw new Error(err.message)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      setPanel(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
    setBusy(false)
  }

  function saveCall() {
    run(async () => {
      if (!lead) return
      const changes: Partial<Lead> = {
        call_attempts: (lead.call_attempts ?? 0) + 1,
        last_call_status: callResult,
      }
      if (callResult === 'Connected' && lead.status === 'New') changes.status = 'Contacted'
      await updateLead(changes)
      await addActivity('Call', callNote || null, callResult)
      setCallNote('')
    })
  }

  function saveNote() {
    run(async () => {
      if (!noteText.trim()) throw new Error('Please write a note first')
      await addActivity('Note', noteText.trim())
      setNoteText('')
    })
  }

  function saveFollowup() {
    run(async () => {
      if (!fuAt) throw new Error('Please pick a date and time')
      const when = new Date(fuAt)
      await updateLead({
        next_followup_at: when.toISOString(),
        followup_type: fuType,
        followup_note: fuNote || null,
      })
      await addActivity(
        'Follow-up set',
        fuType + ' on ' + formatDate(when.toISOString()) + (fuNote ? ' - ' + fuNote : '')
      )
      setFuAt('')
      setFuNote('')
    })
  }

  function saveStatus() {
    run(async () => {
      if (!lead) return
      const target = newStatus || lead.status
      if (target === lead.status) throw new Error('Please choose a different status')
      const changes: Partial<Lead> = { status: target }
      if (closedStatuses.includes(target)) {
        changes.next_followup_at = null
        changes.followup_type = null
        changes.followup_note = null
      }
      await updateLead(changes)
      await addActivity('Status changed', 'Changed from ' + lead.status + ' to ' + target)
      setNewStatus('')
    })
  }

  function saveVisit() {
    run(async () => {
      if (!lead) return
      if (!visitAt) throw new Error('Please pick a date and time')
      const when = new Date(visitAt)
      const { error: err } = await supabase.from('site_visits').insert({
        lead_id: id,
        property_id: lead.property_id,
        visit_at: when.toISOString(),
        assigned_to: lead.assigned_to,
        status: 'Planned',
        notes: visitNote || null,
      })
      if (err) throw new Error(err.message)
      if (earlyStatuses.includes(lead.status)) await updateLead({ status: 'Site Visit Planned' })
      await addActivity(
        'Site visit planned',
        formatDate(when.toISOString()) + (visitNote ? ' - ' + visitNote : '')
      )
      setVisitAt('')
      setVisitNote('')
    })
  }

  if (!lead) {
    return (
      <div>
        <Link href="/leads" className="text-blue-600">&larr; Back to Leads</Link>
        <p className={'mt-4 ' + (error ? 'text-red-600' : 'text-slate-500')}>
          {error || 'Loading...'}
        </p>
      </div>
    )
  }

  const overdue = lead.next_followup_at && new Date(lead.next_followup_at).getTime() < Date.now()
  const goPanel = (x: Panel) => {
    setPanel(x)
    if (x !== 'call') setTimeout(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }), 80)
  }
  const stages = [
    { label: 'New', s: ['New'] },
    { label: 'Contacted', s: ['Contacted'] },
    { label: 'Interested', s: ['Interested', 'Follow-up'] },
    { label: 'Site Visit', s: ['Site Visit Planned', 'Site Visit Done'] },
    { label: 'Negotiation', s: ['Negotiation'] },
    { label: 'Won', s: ['Booked', 'Sold'] },
  ]
  const isLost = lead.status === 'Not Interested' || lead.status === 'Lost'
  const curIdx = stages.findIndex((g) => g.s.includes(lead.status))
  const lastAt = (activities[0] as { created_at?: string } | undefined)?.created_at ?? null
  const daysAgo = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000) : null
  const lastText = daysAgo === null ? 'No contact yet' : daysAgo === 0 ? 'Today' : daysAgo + ' day' + (daysAgo === 1 ? '' : 's') + ' ago'
  const row = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate text-sm font-medium text-slate-100">{value || '-'}</p>
    </div>
  )
  const qBtn = 'ui-focus rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-center text-sm font-semibold text-slate-100 transition-colors hover:bg-line'
  const box2 = 'rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20'

  return (
    <div className="max-w-6xl">
      <Link href="/leads" className="ui-focus text-sm text-accent">&larr; Back to Leads</Link>

      <div className={box2 + ' mt-3 mb-4'}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-blue-300" aria-hidden="true">
            {(lead.name || '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 basis-56">
            <h1 className="truncate text-2xl font-bold text-slate-100">{lead.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <QualityBadge quality={lead.quality} score={lead.score} />
              <StatusPill status={lead.status} />
              <span className="text-sm text-muted">Lead #{lead.lead_no}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {projectName ? 'Project: ' : ''}<b className="text-slate-100">{projectName || 'No project selected'}</b>
              {' · '}Budget: <b className="text-slate-100">{formatBudget(lead.budget)}</b>
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-4">
            <button onClick={() => goPanel('call')} className="ui-focus rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-green-400">Call</button>
            <a href={'https://wa.me/91' + lead.phone} target="_blank" rel="noreferrer" className={qBtn}>WhatsApp</a>
            <button onClick={() => goPanel('followup')} className={qBtn}>Follow-up</button>
            <Link href={'/leads/' + lead.id + '/edit'} className={qBtn}>Edit</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <NextAction status={lead.status} callAttempts={lead.call_attempts} lastCallStatus={lead.last_call_status} nextFollowupAt={lead.next_followup_at} followupType={lead.followup_type} budget={lead.budget} purpose={lead.purpose} timeline={lead.timeline} lastActivityAt={lastAt} />

          <div className={box2}>
            <h2 className="mb-3 text-base font-semibold text-slate-100">Sales Status</h2>
            {isLost ? (
              <p className="rounded-lg border border-red-900 bg-danger-soft px-3 py-2 text-sm font-semibold text-red-300">This lead is closed: {lead.status}</p>
            ) : (
              <ol className="flex gap-1 overflow-x-auto" aria-label="Sales status">
                {stages.map((g, i) => (
                  <li key={g.label} className={'flex-1 whitespace-nowrap rounded-md px-2 py-2 text-center text-xs font-semibold ' + (i === curIdx ? 'bg-accent text-white' : i < curIdx ? 'bg-accent-soft text-blue-300' : 'bg-surface-2 text-muted')}>
                    {g.label}
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-xs text-muted">Current status: {lead.status}</p>
          </div>

          <div className={box2}>
            <h2 className="mb-3 text-base font-semibold text-slate-100">Lead Overview</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {row('Phone', lead.phone)}
              {row('Alternate phone', lead.alt_phone)}
              {row('Assigned to', lead.assigned_to ? people[lead.assigned_to] : 'Unassigned')}
              {row('Source', lead.source)}
              {row('Campaign', lead.campaign)}
              {row('Ad set / Ad', [lead.ad_set, lead.ad].filter(Boolean).join(' / '))}
              {row('Property type', lead.property_type)}
              {row('Preferred location', lead.preferred_location)}
              {row('Purpose', lead.purpose)}
              {row('Payment preference', lead.payment_preference)}
              {row('Interest level', lead.interest_level)}
              {row('Plans to buy', lead.timeline)}
            </div>
            {lead.notes && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{lead.notes}</p>
              </div>
            )}
          </div>

          <div className={box2}>
            <h2 className="mb-3 text-base font-semibold text-slate-100">Activity</h2>
            {activities.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="border-l-2 border-accent pl-3">
                  <p className="text-sm font-medium text-slate-100">{a.type}{a.call_result ? ' - ' + a.call_result : ''}</p>
                  {a.detail && <p className="text-sm text-slate-300">{a.detail}</p>}
                  <p className="text-xs text-muted">{formatDate(a.created_at)}{a.done_by && people[a.done_by] ? ' by ' + people[a.done_by] : ''}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <div className={box2}>
            <h2 className="mb-3 text-base font-semibold text-slate-100">Contact Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              {row('Last contact', lastText)}
              {row('Call attempts', String(lead.call_attempts ?? 0))}
              {row('Last call result', lead.last_call_status)}
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Next follow-up</p>
              {lead.next_followup_at ? (
                <p className={'mt-1 text-sm font-semibold ' + (overdue ? 'text-danger' : 'text-slate-100')}>
                  {overdue ? 'Overdue: ' : ''}{lead.followup_type} on {formatDate(lead.next_followup_at)}
                  {lead.followup_note ? ' - ' + lead.followup_note : ''}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">Not set</p>
              )}
            </div>
          </div>

          <div className={box2}>
            <h2 className="mb-3 text-base font-semibold text-slate-100">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => goPanel('note')} className={qBtn}>Add Note</button>
              <button onClick={() => goPanel('followup')} className={qBtn}>Set Follow-up</button>
              <button onClick={() => goPanel('status')} className={qBtn}>Change Status</button>
              <button onClick={() => goPanel('visit')} className={qBtn}>Site Visit</button>
            </div>
          </div>

          <WhatsAppTemplates name={lead.name} phone={lead.phone} projectName={projectName} />
        </div>
      </div>


      {error && <p className="text-red-600 mb-3">{error}</p>}

      {panel === 'call' && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-4 space-y-3">
          <button onClick={() => setPanel(null)} className="w-full rounded-xl py-3 text-base font-semibold bg-slate-100 text-slate-800">Close</button>
          <CallHelper name={lead.name} projectName={projectName} budget={lead.budget} purpose={lead.purpose} timeline={lead.timeline} paymentPreference={lead.payment_preference} source={lead.source} campaign={lead.campaign} />
          <a href={'tel:' + lead.phone} className="block rounded-xl py-3 px-2 text-base font-semibold text-center bg-green-600 text-white">Start Call ({lead.phone})</a>
          <p className="font-semibold text-slate-800">How did the call go?</p>
          <select className={box} value={callResult} onChange={(e) => setCallResult(e.target.value)}>
            {callResults.map((r) => <option key={r}>{r}</option>)}
          </select>
          <textarea rows={3} placeholder="Call notes" className={box}
            value={callNote} onChange={(e) => setCallNote(e.target.value)} />
          <button disabled={busy} onClick={saveCall}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
            {busy ? 'Saving...' : 'Save Call'}
          </button>
        </div>
      )}

      {panel === 'note' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="font-semibold text-slate-800">Add a note</p>
          <textarea rows={4} className={box} value={noteText}
            onChange={(e) => setNoteText(e.target.value)} />
          <button disabled={busy} onClick={saveNote}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
            {busy ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      )}

      {panel === 'followup' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="font-semibold text-slate-800">Set next follow-up</p>
          <input type="datetime-local" className={box} value={fuAt}
            onChange={(e) => setFuAt(e.target.value)} />
          <select className={box} value={fuType} onChange={(e) => setFuType(e.target.value)}>
            {followupTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input placeholder="Follow-up note (optional)" className={box} value={fuNote}
            onChange={(e) => setFuNote(e.target.value)} />
          <button disabled={busy} onClick={saveFollowup}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
            {busy ? 'Saving...' : 'Save Follow-up'}
          </button>
        </div>
      )}

      {panel === 'status' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="font-semibold text-slate-800">Change status</p>
          <select className={box} value={newStatus || lead.status}
            onChange={(e) => setNewStatus(e.target.value)}>
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button disabled={busy} onClick={saveStatus}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
            {busy ? 'Saving...' : 'Save Status'}
          </button>
        </div>
      )}

      {panel === 'visit' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <p className="font-semibold text-slate-800">Schedule a site visit</p>
          <input type="datetime-local" className={box} value={visitAt}
            onChange={(e) => setVisitAt(e.target.value)} />
          <input placeholder="Visit notes (optional)" className={box} value={visitNote}
            onChange={(e) => setVisitNote(e.target.value)} />
          <button disabled={busy} onClick={saveVisit}
            className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
            {busy ? 'Saving...' : 'Save Site Visit'}
          </button>
        </div>
      )}
    </div>
  )
}
