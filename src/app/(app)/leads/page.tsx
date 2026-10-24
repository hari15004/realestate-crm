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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [quality, setQuality] = useState('')
  const [source, setSource] = useState('')

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
  }, [search, status, quality, source])

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

      <div className="flex flex-wrap gap-2 mb-4">
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
                href={'tel:' + l.phone}
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
