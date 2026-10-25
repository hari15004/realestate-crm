'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DataTools from '@/components/DataTools'

const supabase = createClient()

const closed = '(Booked,Sold,Not Interested,Lost)'

type Row = { label: string; value: number; warn?: boolean }
type Section = { title: string; rows: Row[] }

export default function ReportsPage() {
  const [sections, setSections] = useState<Section[] | null>(null)
  const [dateText, setDateText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const now = new Date()
      const startToday = new Date()
      startToday.setHours(0, 0, 0, 0)
      const startTomorrow = new Date(startToday)
      startTomorrow.setDate(startTomorrow.getDate() + 1)
      const startYesterday = new Date(startToday)
      startYesterday.setDate(startYesterday.getDate() - 1)

      const nowIso = now.toISOString()
      const todayIso = startToday.toISOString()
      const tomorrowIso = startTomorrow.toISOString()
      const yesterdayIso = startYesterday.toISOString()

      const base = () => supabase.from('leads').select('id', { count: 'exact', head: true })
      const active = () => base().not('status', 'in', closed)
      const visits = () => supabase.from('site_visits').select('id', { count: 'exact', head: true })
      const acts = () => supabase.from('activities').select('id', { count: 'exact', head: true })

      const results = await Promise.all([
        base().gte('created_at', todayIso),
        base().gte('created_at', yesterdayIso).lt('created_at', todayIso),
        base().gte('created_at', todayIso).eq('quality', 'Best'),
        base().gte('created_at', todayIso).eq('quality', 'Good'),
        base().gte('created_at', todayIso).eq('quality', 'Medium'),
        base().gte('created_at', todayIso).eq('quality', 'Poor'),
        acts().eq('type', 'Call').gte('created_at', todayIso),
        acts().eq('type', 'Call').eq('call_result', 'Connected').gte('created_at', todayIso),
        active().eq('followup_type', 'Call').lt('next_followup_at', tomorrowIso),
        active().gte('next_followup_at', nowIso).lt('next_followup_at', tomorrowIso),
        active().lt('next_followup_at', nowIso),
        visits().in('status', ['Planned', 'Rescheduled']).gte('visit_at', todayIso),
        visits().eq('status', 'Completed').gte('visit_at', todayIso).lt('visit_at', tomorrowIso),
        base().in('status', ['Booked', 'Sold']),
        base().in('status', ['Not Interested', 'Lost']),
      ])

      const failed = results.find((r) => r.error)
      if (failed && failed.error) {
        setError('Could not load the report: ' + failed.error.message)
        return
      }

      const n = (i: number) => results[i].count ?? 0

      setDateText(
        new Date().toLocaleDateString('en-IN', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      )
      setSections([
        {
          title: 'Leads',
          rows: [
            { label: 'Leads received today', value: n(0) },
            { label: 'Leads received yesterday', value: n(1) },
            { label: 'Best leads (received today)', value: n(2) },
            { label: 'Good leads (received today)', value: n(3) },
            { label: 'Medium leads (received today)', value: n(4) },
            { label: 'Poor leads (received today)', value: n(5) },
          ],
        },
        {
          title: 'Calls',
          rows: [
            { label: 'Calls completed today', value: n(6) },
            { label: 'Calls connected today', value: n(7) },
            { label: 'Calls pending (due today or overdue)', value: n(8) },
          ],
        },
        {
          title: 'Follow-ups',
          rows: [
            { label: 'Follow-ups due today', value: n(9) },
            { label: 'Follow-ups overdue', value: n(10), warn: true },
          ],
        },
        {
          title: 'Site Visits',
          rows: [
            { label: 'Site visits planned (today and later)', value: n(11) },
            { label: 'Site visits completed today', value: n(12) },
          ],
        },
        {
          title: 'Results (all time)',
          rows: [
            { label: 'Bookings', value: n(13) },
            { label: 'Lost leads', value: n(14) },
          ],
        },
      ])
    }
    load()
  }, [])

  async function copyReport() {
    if (!sections) return
    const lines = ['Daily Report - ' + dateText, '']
    sections.forEach((s) => {
      lines.push(s.title.toUpperCase())
      s.rows.forEach((r) => lines.push('- ' + r.label + ': ' + r.value))
      lines.push('')
    })
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Please select the text and copy it manually.')
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Daily Report</h1>
          <p className="text-sm text-muted">{dateText}</p>
        </div>
        <button
          onClick={copyReport}
          disabled={!sections}
          className="ui-focus rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
        >
          {copied ? 'Copied!' : 'Copy Report'}
        </button>
      </div>

      {error && <p className="mb-3 text-danger">{error}</p>}
      {!sections && !error && <p className="text-muted">Loading...</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {sections?.map((s) => {
          const max = Math.max(1, ...s.rows.map((r) => r.value))
          return (
            <div key={s.title} className="rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20">
              <h2 className="mb-3 text-base font-semibold text-slate-100">{s.title}</h2>
              <div className="space-y-3">
                {s.rows.map((r) => {
                  const bad = r.warn && r.value > 0
                  return (
                    <div key={r.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-300">{r.label}</span>
                        <span className={'text-base font-bold ' + (bad ? 'text-danger' : 'text-slate-100')}>{r.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2">
                        <div
                          className={'h-1.5 rounded-full ' + (bad ? 'bg-danger' : 'bg-accent')}
                          style={{ width: (r.value / max) * 100 + '%' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <DataTools />
    </div>
  )
}
