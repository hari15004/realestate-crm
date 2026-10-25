'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

type Props = { overdue: number; dueToday: number; visitsToday: number; hot: number; newToday: number }

export default function TodayPriority(p: Props) {
  const [name, setName] = useState('')
  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user.id
      if (!uid) return
      const { data } = await supabase.from('profiles').select('full_name').eq('id', uid).single()
      setName((data?.full_name as string) ?? '')
    }
    load()
  }, [])
  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const items = [
    { n: p.overdue, title: 'Overdue follow-ups', hint: 'These customers are waiting. Call them first.', href: '/followups', cta: 'View follow-ups', tone: 'border-red-500' },
    { n: p.dueToday, title: 'Follow-ups due today', hint: 'Do not miss these opportunities.', href: '/followups', cta: 'View follow-ups', tone: 'border-yellow-500' },
    { n: p.visitsToday, title: 'Site visits today', hint: 'Confirm the visit with each customer.', href: '/site-visits', cta: 'View visits', tone: 'border-blue-500' },
    { n: p.hot, title: 'Best leads', hint: 'Highest score. Contact them early.', href: '/leads', cta: 'View leads', tone: 'border-green-500' },
    { n: p.newToday, title: 'New leads today', hint: 'Make the first call quickly.', href: '/leads', cta: 'View leads', tone: 'border-blue-500' },
  ].filter((i) => i.n > 0)
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-slate-800">{greet}{name ? ', ' + name : ''}</h1>
      <p className="text-slate-500 mb-3">Here is what needs your attention today.</p>
      {items.length === 0 && <p className="text-slate-500">Nothing urgent right now. Good work!</p>}
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((i) => (
          <div key={i.title} className={'bg-white rounded-2xl shadow p-4 border-l-4 ' + i.tone}>
            <p className="text-base font-semibold text-slate-800">{i.n} {i.title}</p>
            <p className="text-sm text-slate-500">{i.hint}</p>
            <Link href={i.href} className="inline-block mt-2 text-blue-600 font-semibold">{i.cta} &rarr;</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
