'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const statuses = [
  'New', 'Contacted', 'Interested', 'Follow-up', 'Site Visit Planned',
  'Site Visit Done', 'Negotiation', 'Booked', 'Sold', 'Not Interested', 'Lost',
]
const qualities = ['Best', 'Good', 'Medium', 'Poor']
const sources = ['Meta', 'Instagram', 'Website', 'WhatsApp', 'Referral', 'Phone', 'Other']

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
  source: string
  status: string
  quality: string
  score: number
  budget: number | null
  next_followup_at: string | null
}

type Person = { id: string; full_name: string | null }

function formatBudget(n: number | null) {
  if (!n) return '-'
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + ' L'
  return '₹' + n
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  })
}

const select = 'border rounded-xl px-3 py-3 text-base bg-white'
const small = 'w-full border rounded-xl px-3 py-3 text-base bg-white'

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [quality, setQuality] = useState('')
  const [source, setSource] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [campaign, setCampaign] = useState('')
  const [minLakh, setMinLakh] = useState('')
  const [maxLakh, setMaxLakh] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [assigned, setAssigned] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, full_name')
      .then(({ data }) => setPeople((data ?? []) as Person[]))
  }, [])

  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      let q = supabase
        .from('leads')
        .select('id, lead_no, name, phone, source, status, quality, score, budget, next_followup_at')
        .order('created_at', { ascending: false })
        .limit(200)

      if (status) q = q.eq('status', status)
      if (quality) q = q.eq('quality', quality)
      if (source) q = q.eq('source', source)

      const c = campaign.trim().replace(/[%,()]/g, '')
      if (c) q = q.ilike('campaign', '%' + c + '%')
      if (minLakh !== '' && Number(minLakh) >= 0) q = q.gte('budget', Number(minLakh) * 100000)
      if (maxLakh !== '' && Number(maxLakh) >= 0) q = q.lte('budget', Number(maxLakh) * 100000)
      if (fromDate) q = q.gte('created_at', new Date(fromDate + 'T00:00:00').toISOString())
      if (toDate) {
        const end = new Date(toDate + 'T00:00:00')
        end.setDate(end.getDate() + 1)
        q = q.lt('created_at', end.toISOString())
      }
      if (assigned === 'none') q = q.is('assigned_to', null)
      else if (assigned) q = q.eq('assigned_to', assigned)

      const s = search.trim().replace(/[,()%]/g, '')
      if (s) {
        const parts = ['name.ilike.%' + s + '%', 'phone.ilike.%' + s + '%']
        if (/^\d+$/.test(s) && s.length <= 9) parts.push('lead_no.eq.' + s)
        q = q.or(parts.join(','))
      }

      const { data, error: err } = await q
      if (cancelled) return
      if (err) setError('Could not load leads: ' + err.message)
      else {
        setError('')
        setLeads((data ?? []) as Lead[])
      }
      setLoading(false)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, status, quality, source, campaign, minLakh, maxLakh, fromDate, toDate, assigned])

  function clearAll() {
    setSearch(''); setStatus(''); setQuality(''); setSource('')
    setCampaign(''); setMinLakh(''); setMaxLakh('')
    setFromDate(''); setToDate(''); setAssigned('')
  }

  const now = Date.now()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Leads</h1>
        <Link
          href="/leads/new"
          className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold"
        >
          + Add Lead
        </Link>
      </div>

      <input
        placeholder="Search by name, phone or lead number"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border rounded-xl px-4 py-3 text-base bg-white mb-3"
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={select} value={quality} onChange={(e) => setQuality(e.target.value)}>
          <option value="">All quality</option>
          {qualities.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className={select} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-4 mb-4">
        <button onClick={() => setShowMore(!showMore)} className="text-blue-600 font-semibold">
          {showMore ? 'Hide more filters' : 'More filters'}
        </button>
        <button onClick={clearAll} className="text-slate-500">Clear all</button>
      </div>

      {showMore && (
        <div className="bg-white rounded-2xl shadow p-4 mb-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <p className="text-xs text-slate-500 mb-1">Campaign name contains</p>
            <input className={small} value={campaign} onChange={(e) => setCampaign(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Budget min (lakh)</p>
            <input type="number" min="0" className={small} value={minLakh} onChange={(e) => setMinLakh(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Budget max (lakh)</p>
            <input type="number" min="0" className={small} value={maxLakh} onChange={(e) => setMaxLakh(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Created from</p>
            <input type="date" className={small} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Created to</p>
            <input type="date" className={small} value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="col-span-2">
            <p className="text-xs text-slate-500 mb-1">Assigned to</p>
            <select className={small} value={assigned} onChange={(e) => setAssigned(e.target.value)}>
              <option value="">Everyone</option>
              <option value="none">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name ?? 'Unknown'}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-slate-500">Loading...</p>}
      {!loading && !error && leads.length === 0 && (
        <p className="text-slate-500">No leads found.</p>
      )}

      <div className="space-y-3">
        {leads.map((l) => {
          const overdue = l.next_followup_at && new Date(l.next_followup_at).getTime() < now
          return (
            <div key={l.id} className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={'/leads/' + l.id} className="text-lg font-semibold text-slate-800">
                    {l.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    #{l.lead_no} · {l.source} · {l.phone}
                  </p>
                </div>
                <span className={'rounded-full px-3 py-1 text-sm font-medium ' + (qualityColor[l.quality] ?? '')}>
                  {l.quality} ({l.score})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-slate-600">
                <span>Status: <b>{l.status}</b></span>
                <span>Budget: <b>{formatBudget(l.budget)}</b></span>
                {l.next_followup_at && (
                  <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                    {overdue ? 'Overdue: ' : 'Follow-up: '}
                    {formatDate(l.next_followup_at)}
                  </span>
                )}
              </div>

              <div className="mt-3 flex gap-2">
                <a
                  href={'/leads/' + l.id + '?call=1'}
                  className="flex-1 block text-center bg-green-600 text-white rounded-xl py-3 font-semibold"
                >
                  Call
                </a>
                <a
                  href={'https://wa.me/91' + l.phone}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 block text-center bg-emerald-800 text-white rounded-xl py-3 font-semibold"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}