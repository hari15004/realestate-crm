'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { StatusPill } from '@/components/ui'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Item = {
  id: string
  lead_no: number
  name: string
  phone: string
  status: string
  quality: string
  next_followup_at: string
  followup_type: string | null
  followup_note: string | null
}

function formatWhen(d: string, withDate: boolean) {
  return new Date(d).toLocaleString(
    'en-IN',
    withDate
      ? { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }
      : { hour: 'numeric', minute: '2-digit' }
  )
}

export default function FollowupsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'all' | 'overdue' | 'today' | 'tomorrow'>('all')

  useEffect(() => {
    async function load() {
      const dayAfterTomorrow = new Date()
      dayAfterTomorrow.setHours(0, 0, 0, 0)
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)

      const { data, error: err } = await supabase
        .from('leads')
        .select(
          'id, lead_no, name, phone, status, quality, next_followup_at, followup_type, followup_note'
        )
        .not('next_followup_at', 'is', null)
        .not('status', 'in', '(Booked,Sold,Not Interested,Lost)')
        .lt('next_followup_at', dayAfterTomorrow.toISOString())
        .order('next_followup_at', { ascending: true })

      if (err) setError('Could not load follow-ups: ' + err.message)
      else setItems((data ?? []) as Item[])
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const startTomorrow = new Date()
  startTomorrow.setHours(0, 0, 0, 0)
  startTomorrow.setDate(startTomorrow.getDate() + 1)

  const overdue = items.filter((i) => new Date(i.next_followup_at) < now)
  const today = items.filter((i) => {
    const t = new Date(i.next_followup_at)
    return t >= now && t < startTomorrow
  })
  const tomorrow = items.filter((i) => new Date(i.next_followup_at) >= startTomorrow)

  const tabs = [
    { key: 'all', label: 'All', n: items.length },
    { key: 'overdue', label: 'Overdue', n: overdue.length },
    { key: 'today', label: 'Today', n: today.length },
    { key: 'tomorrow', label: 'Tomorrow', n: tomorrow.length },
  ] as const
  const shown = tab === 'overdue' ? overdue : tab === 'today' ? today : tab === 'tomorrow' ? tomorrow : items

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-100">Follow-ups</h1>
      <p className="mb-4 text-sm text-muted">Keep track of all follow-ups</p>

      {error && <p className="mb-3 text-danger">{error}</p>}
      {loading && <p className="text-muted">Loading...</p>}

      {!loading && !error && (
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
                {t.label} <span className={t.key === 'overdue' && t.n > 0 ? 'text-red-300' : 'opacity-70'}>({t.n})</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-line bg-surface shadow-sm shadow-black/20">
            {shown.length === 0 && <p className="p-6 text-center text-sm text-muted">No follow-ups here.</p>}
            <ul className="divide-y divide-line">
              {shown.map((l) => {
                const late = new Date(l.next_followup_at) < now
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-surface-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-blue-300" aria-hidden="true">
                      {(l.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <Link href={'/leads/' + l.id} className="ui-focus block truncate text-base font-semibold text-slate-100">{l.name}</Link>
                      <p className="truncate text-sm text-muted">
                        #{l.lead_no} · {l.phone} · <b className="text-slate-300">{l.followup_type ?? 'Call'}</b>
                        {l.followup_note ? ' - ' + l.followup_note : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={'whitespace-nowrap rounded-md border px-2 py-1 text-xs font-semibold ' + (late ? 'border-red-900 bg-danger-soft text-red-300' : 'border-blue-900 bg-accent-soft text-blue-300')}>
                        {late ? 'Overdue ' : ''}{formatWhen(l.next_followup_at, late || tab !== 'today')}
                      </span>
                      <StatusPill status={l.status} />
                    </div>
                    <div className="flex gap-2">
                      <a href={'/leads/' + l.id + '?call=1'} className="ui-focus rounded-lg bg-success px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-green-400">Call</a>
                      <Link href={'/leads/' + l.id} className="ui-focus rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:bg-line">Open</Link>
                    </div>
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
