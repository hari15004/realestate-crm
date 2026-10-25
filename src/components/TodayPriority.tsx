'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, ButtonLink } from '@/components/ui'

const supabase = createClient()

type Props = { overdue: number; dueToday: number; visitsToday: number; hot: number; newToday: number }

function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={'h-5 w-5 ' + className} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const icons = {
  alert: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  home: 'M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  plus: 'M12 5v14M5 12h14',
}

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
    { n: p.overdue, title: 'Overdue follow-ups', hint: 'These customers are waiting. Call them first.', href: '/followups', cta: 'View follow-ups', icon: icons.alert, color: 'text-danger', edge: 'border-l-danger' },
    { n: p.dueToday, title: 'Follow-ups due today', hint: 'Do not miss these opportunities.', href: '/followups', cta: 'View follow-ups', icon: icons.phone, color: 'text-warn', edge: 'border-l-warn' },
    { n: p.visitsToday, title: 'Site visits today', hint: 'Confirm the visit with each customer.', href: '/site-visits', cta: 'View visits', icon: icons.home, color: 'text-accent', edge: 'border-l-accent' },
    { n: p.hot, title: 'Best leads', hint: 'Highest score. Contact them early.', href: '/leads', cta: 'View leads', icon: icons.star, color: 'text-success', edge: 'border-l-success' },
    { n: p.newToday, title: 'New leads today', hint: 'Make the first call quickly.', href: '/leads', cta: 'View leads', icon: icons.plus, color: 'text-violet', edge: 'border-l-violet' },
  ].filter((i) => i.n > 0)
  return (
    <section className="mb-6" aria-label="Today's priority">
      <h1 className="text-2xl font-bold text-slate-100">{greet}{name ? ', ' + name : ''}</h1>
      <p className="mb-4 text-muted">Here is what needs your attention today.</p>
      {items.length === 0 && (
        <Card><p className="text-sm text-muted">Nothing urgent right now. Good work!</p></Card>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.title} className={'border-l-4 transition-colors hover:bg-surface-2 ' + i.edge}>
            <div className="flex items-start gap-3">
              <Icon d={i.icon} className={'mt-1 shrink-0 ' + i.color} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-100">
                  <span className={'mr-1 text-xl ' + i.color}>{i.n}</span>{i.title}
                </p>
                <p className="text-sm text-muted">{i.hint}</p>
                <ButtonLink href={i.href} variant="secondary" className="mt-3">{i.cta} &rarr;</ButtonLink>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}