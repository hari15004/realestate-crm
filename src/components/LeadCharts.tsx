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
    <div className="bg-white rounded-2xl shadow p-4">
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
      <Bars title="Sales Pipeline" rows={pipeline} color="bg-blue-600" />
      <Bars title="Lead Health" rows={health} color="bg-green-600" />
      <Bars title="Leads by Status" rows={byStatus} color="bg-blue-600" />
      <Bars title="Leads by Source" rows={bySource} color="bg-green-600" />
    </div>
  )
}