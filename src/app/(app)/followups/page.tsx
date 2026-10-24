'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

function Section({
  title,
  items,
  tone,
  empty,
  withDate,
}: {
  title: string
  items: Item[]
  tone: 'red' | 'blue' | 'slate'
  empty: string
  withDate: boolean
}) {
  const heading =
    tone === 'red' ? 'text-red-600' : tone === 'blue' ? 'text-blue-700' : 'text-slate-700'
  const border =
    tone === 'red' ? 'border-red-400' : tone === 'blue' ? 'border-blue-400' : 'border-slate-300'

  return (
    <section className="mb-8">
      <h2 className={'text-lg font-semibold mb-3 ' + heading}>
        {title} ({items.length})
      </h2>
      {items.length === 0 && <p className="text-slate-500">{empty}</p>}
      <div className="space-y-3">
        {items.map((l) => (
          <div key={l.id} className={'bg-white rounded-2xl shadow p-4 border-l-4 ' + border}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link href={'/leads/' + l.id} className="text-lg font-semibold text-slate-800">
                  {l.name}
                </Link>
                <p className="text-sm text-slate-500">
                  #{l.lead_no} · {l.phone} · {l.status}
                </p>
              </div>
              <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                {formatWhen(l.next_followup_at, withDate)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              <b>{l.followup_type ?? 'Call'}</b>
              {l.followup_note ? ' - ' + l.followup_note : ''}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <a
                href={'tel:' + l.phone}
                className="text-center bg-green-600 text-white rounded-xl py-3 font-semibold"
              >
                Call
              </a>
              <Link
                href={'/leads/' + l.id}
                className="text-center bg-slate-100 text-slate-800 rounded-xl py-3 font-semibold"
              >
                Open Lead
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function FollowupsPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Follow-ups</h1>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {loading && <p className="text-slate-500">Loading...</p>}

      {!loading && !error && (
        <>
          <Section
            title="Overdue"
            items={overdue}
            tone="red"
            empty="Nothing overdue. Great job!"
            withDate={true}
          />
          <Section
            title="Today"
            items={today}
            tone="blue"
            empty="No more follow-ups for today."
            withDate={false}
          />
          <Section
            title="Tomorrow"
            items={tomorrow}
            tone="slate"
            empty="No follow-ups planned for tomorrow."
            withDate={false}
          />
        </>
      )}
    </div>
  )
}
