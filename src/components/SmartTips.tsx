'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const closed = '(Booked,Sold,Not Interested,Lost)'

type Tip = { text: string; href: string; color: string }

export default function SmartTips() {
  const [tips, setTips] = useState<Tip[]>([])

  useEffect(() => {
    async function load() {
      const now = new Date()
      const nowIso = now.toISOString()
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const startToday = new Date()
      startToday.setHours(0, 0, 0, 0)
      const startTomorrow = new Date(startToday)
      startTomorrow.setDate(startTomorrow.getDate() + 1)

      const leads = () => supabase.from('leads').select('id', { count: 'exact', head: true })
      const active = () => leads().not('status', 'in', closed)

      const [a, b, c, d] = await Promise.all([
        active().in('quality', ['Best', 'Good']).lt('next_followup_at', nowIso),
        active().is('next_followup_at', null),
        leads().eq('status', 'New').lt('created_at', dayAgo),
        supabase.from('site_visits').select('id', { count: 'exact', head: true })
          .in('status', ['Planned', 'Rescheduled'])
          .gte('visit_at', startToday.toISOString())
          .lt('visit_at', startTomorrow.toISOString()),
      ])

      const list: Tip[] = []
      const n1 = a.count ?? 0
      const n2 = b.count ?? 0
      const n3 = c.count ?? 0
      const n4 = d.count ?? 0
      if (n1 > 0) list.push({
        text: n1 + ' Best/Good lead(s) have an overdue follow-up. Call them first.',
        href: '/followups', color: 'text-red-600',
      })
      if (n3 > 0) list.push({
        text: n3 + ' new lead(s) have not been contacted for over 24 hours.',
        href: '/leads', color: 'text-red-600',
      })
      if (n2 > 0) list.push({
        text: n2 + ' active lead(s) have no follow-up planned.',
        href: '/leads', color: 'text-yellow-600',
      })
      if (n4 > 0) list.push({
        text: n4 + ' site visit(s) planned for today.',
        href: '/site-visits', color: 'text-blue-600',
      })
      setTips(list)
    }
    load()
  }, [])

  if (tips.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-2">Smart Suggestions</h2>
      <ul className="space-y-2">
        {tips.map((t) => (
          <li key={t.text}>
            <Link href={t.href} className={'font-medium ' + t.color}>
              {t.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}