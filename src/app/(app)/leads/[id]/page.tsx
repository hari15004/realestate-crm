'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import NextAction from '@/components/NextAction'
import WhatsAppTemplates from '@/components/WhatsAppTemplates'
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
  const actionBtn = 'rounded-xl py-3 px-2 text-base font-semibold text-center bg-slate-100 text-slate-800'

  return (
    <div className="max-w-2xl">
      <Link href="/leads" className="text-blue-600">&larr; Back to Leads</Link>

      <div className="flex items-start justify-between gap-3 mt-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{lead.name}</h1>
          <p className="text-slate-500">Lead #{lead.lead_no}</p>
          <Link href={'/leads/' + lead.id + '/edit'} className="inline-block mt-2 text-blue-600 font-semibold">Edit Lead / Reassign</Link>
        </div>
        <span className={'rounded-full px-3 py-1 text-sm font-medium ' + (qualityColor[lead.quality] ?? '')}>
          {lead.quality} ({lead.score})
        </span>
      </div>

      <NextAction status={lead.status} callAttempts={lead.call_attempts} lastCallStatus={lead.last_call_status} nextFollowupAt={lead.next_followup_at} followupType={lead.followup_type} budget={lead.budget} purpose={lead.purpose} timeline={lead.timeline} lastActivityAt={(activities[0] as { created_at?: string } | undefined)?.created_at ?? null} />
      <div className="bg-white rounded-2xl shadow p-4 grid grid-cols-2 gap-4 mb-6">
        <Info label="Phone" value={lead.phone} />
        <Info label="Alternate phone" value={lead.alt_phone} />
        <Info label="Status" value={lead.status} />
        <Info label="Assigned to" value={lead.assigned_to ? people[lead.assigned_to] : 'Unassigned'} />
        <Info label="Source" value={lead.source} />
        <Info label="Campaign" value={lead.campaign} />
        <Info label="Ad set / Ad" value={[lead.ad_set, lead.ad].filter(Boolean).join(' / ')} />
        <Info label="Project" value={projectName || null} />
        <Info label="Property type" value={lead.property_type} />
        <Info label="Preferred location" value={lead.preferred_location} />
        <Info label="Budget" value={formatBudget(lead.budget)} />
        <Info label="Purpose" value={lead.purpose} />
        <Info label="Payment preference" value={lead.payment_preference} />
        <Info label="Interest level" value={lead.interest_level} />
        <Info label="Plans to buy" value={lead.timeline} />
        <Info label="Call attempts" value={String(lead.call_attempts ?? 0)} />
        <Info label="Last call result" value={lead.last_call_status} />
        <div className="col-span-2">
          <p className="text-xs text-slate-500">Next follow-up</p>
          {lead.next_followup_at ? (
            <p className={'text-base ' + (overdue ? 'text-red-600 font-semibold' : 'text-slate-800')}>
              {overdue ? 'Overdue: ' : ''}
              {lead.followup_type} on {formatDate(lead.next_followup_at)}
              {lead.followup_note ? ' - ' + lead.followup_note : ''}
            </p>
          ) : (
            <p className="text-base text-slate-800">-</p>
          )}
        </div>
        <div className="col-span-2">
          <Info label="Notes" value={lead.notes} />
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-800 mb-2">Activity</h2>
      <div className="bg-white rounded-2xl shadow p-4 mb-6 space-y-4">
        {activities.length === 0 && <p className="text-slate-500">No activity yet.</p>}
        {activities.map((a) => (
          <div key={a.id} className="border-l-4 border-blue-200 pl-3">
            <p className="font-medium text-slate-800">
              {a.type}
              {a.call_result ? ' - ' + a.call_result : ''}
            </p>
            {a.detail && <p className="text-slate-600">{a.detail}</p>}
            <p className="text-xs text-slate-500">
              {formatDate(a.created_at)}
              {a.done_by && people[a.done_by] ? ' by ' + people[a.done_by] : ''}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-slate-800 mb-2">Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <a
          href={'tel:' + lead.phone}
          onClick={() => setPanel('call')}
          className="rounded-xl py-3 px-2 text-base font-semibold text-center bg-green-600 text-white"
        >
          Call
        </a>
        <button onClick={() => setPanel('note')} className={actionBtn}>Add Note</button>
        <button onClick={() => setPanel('followup')} className={actionBtn}>Set Follow-up</button>
        <button onClick={() => setPanel('status')} className={actionBtn}>Change Status</button>
        <button onClick={() => setPanel('visit')} className={actionBtn}>Schedule Site Visit</button>
      </div>

      <WhatsAppTemplates name={lead.name} phone={lead.phone} projectName={projectName} />

      {error && <p className="text-red-600 mb-3">{error}</p>}

      {panel === 'call' && (
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
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
