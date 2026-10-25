'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const statusOrder = [
  'New', 'Contacted', 'Interested', 'Follow-up', 'Site Visit Planned',
  'Site Visit Done', 'Negotiation', 'Booked', 'Sold', 'Not Interested', 'Lost',
]

type Row = { label: string; count: number }

const stages: { label: string; statuses: string[] }[] = [
  { label: 'New', statuses: ['New'] },
  { label: 'Contacted', statuses: ['Contacted'] },
  { label: 'Interested', statuses: ['Interested', 'Follow-up'] },
  { label: 'Site Visit', statuses: ['Site Visit Planned', 'Site Visit Done'] },
  { label: 'Negotiation', statuses: ['Negotiation'] },
  { label: 'Won', statuses: ['Booked', 'Sold'] },
  { label: 'Lost', statuses: ['Not Interested', 'Lost'] },
]
const qualities = ['Best', 'Good', 'Medium', 'Poor']

function Bars({ title, rows, color }: { title: string; rows: Row[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20">
      <h2 className="text-lg font-semibold text-slate-800 mb-3">{title}</h2>
      {rows.length === 0 && <p className="text-slate-500">No data yet.</p>}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>{r.label}</span>
              <span className="font-semibold">{r.count}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className={'h-2 rounded-full transition-all duration-700 ' + color}
                style={{ width: (r.count / max) * 100 + '%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const stageColors = ['bg-blue-500', 'bg-sky-400', 'bg-amber-400', 'bg-violet-500', 'bg-orange-500', 'bg-green-500', 'bg-red-500']
const healthColors: Record<string, string> = { Best: 'bg-green-500', Good: 'bg-blue-500', Medium: 'bg-amber-400', Poor: 'bg-slate-500' }

function PipelineBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20">
      <h2 className="mb-1 text-base font-semibold text-slate-100">Sales Pipeline</h2>
      <p className="mb-3 text-sm text-muted">Leads in each stage right now</p>
      <div className="flex h-40 items-end gap-2">
        {rows.map((r, i) => (
          <div key={r.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-sm font-semibold text-slate-100">{r.count}</span>
            <div className={'w-full rounded-t-md ' + stageColors[i % stageColors.length]}
              style={{ height: Math.max(4, (r.count / max) * 100) + '%' }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {rows.map((r) => (
          <span key={r.label} className="flex-1 text-center text-[11px] text-muted">{r.label}</span>
        ))}
      </div>
    </div>
  )
}

function HealthBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20">
      <h2 className="mb-3 text-base font-semibold text-slate-100">Lead Health</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="mb-1 flex justify-between text-sm text-slate-300">
              <span className="flex items-center gap-2">
                <span className={'h-2.5 w-2.5 rounded-full ' + (healthColors[r.label] ?? 'bg-slate-500')} />
                {r.label}
              </span>
              <span className="font-semibold text-slate-100">{r.count}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className={'h-2 rounded-full ' + (healthColors[r.label] ?? 'bg-slate-500')}
                style={{ width: (r.count / max) * 100 + '%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LeadCharts() {
  const [byStatus, setByStatus] = useState<Row[]>([])
  const [bySource, setBySource] = useState<Row[]>([])
  const [pipeline, setPipeline] = useState<Row[]>([])
  const [health, setHealth] = useState<Row[]>([])

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('leads').select('status, source, quality').limit(5000)
      const st: Record<string, number> = {}
      const so: Record<string, number> = {}
      const ql: Record<string, number> = {}
      ;(data ?? []).forEach((l) => {
        const s = l.status as string
        const c = (l.source as string) || 'Other'
        st[s] = (st[s] ?? 0) + 1
        so[c] = (so[c] ?? 0) + 1
        const q = (l.quality as string) || 'Poor'
        ql[q] = (ql[q] ?? 0) + 1
      })
      setPipeline(stages.map((g) => ({ label: g.label, count: g.statuses.reduce((n, x) => n + (st[x] ?? 0), 0) })))
      setHealth(qualities.map((q) => ({ label: q, count: ql[q] ?? 0 })))
      setByStatus(
        statusOrder.filter((s) => st[s]).map((s) => ({ label: s, count: st[s] }))
      )
      setBySource(
        Object.keys(so)
          .sort((a, b) => so[b] - so[a])
          .map((s) => ({ label: s, count: so[s] }))
      )
    }
    load()
  }, [])

  return (
    <div className="grid md:grid-cols-2 gap-4 mb-8">
      <PipelineBars rows={pipeline} />
      <HealthBars rows={health} />
      <Bars title="Leads by Status" rows={byStatus} color="bg-blue-600" />
      <Bars title="Leads by Source" rows={bySource} color="bg-green-600" />
    </div>
  )
}