'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, SectionHeader, EmptyState } from '@/components/ui'

const supabase = createClient()
type Row = { id: string; lead_id: string; type: string; detail: string | null; created_at: string }

export default function RecentActivity() {
  const [rows, setRows] = useState<Row[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('activities')
        .select('id, lead_id, type, detail, created_at').order('created_at', { ascending: false }).limit(6)
      const list = (data ?? []) as Row[]
      setRows(list)
      const ids = Array.from(new Set(list.map((r) => r.lead_id)))
      if (!ids.length) return
      const { data: l } = await supabase.from('leads').select('id, name').in('id', ids)
      const m: Record<string, string> = {}
      for (const x of l ?? []) m[x.id as string] = x.name as string
      setNames(m)
    }
    load()
  }, [])
  return (
    <Card className="mb-8">
      <SectionHeader title="Recent Activity" hint="Latest actions on your leads" />
      {rows.length === 0 && <EmptyState message="No activity yet." />}
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100">{r.type}
                <Link href={'/leads/' + r.lead_id} className="ui-focus ml-2 text-accent">{names[r.lead_id] ?? 'Lead'}</Link>
              </p>
              {r.detail && <p className="truncate text-xs text-muted">{r.detail}</p>}
            </div>
            <span className="whitespace-nowrap text-xs text-muted">
              {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
