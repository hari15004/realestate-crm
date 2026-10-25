'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { downloadXlsx } from '@/lib/exportXlsx'
import { calculateScore } from '@/lib/scoring'

const supabase = createClient()

const sources = ['Meta', 'Instagram', 'Website', 'WhatsApp', 'Referral', 'Phone', 'Other']
const types = ['Plot', 'Flat/Apartment', 'Villa/House', 'Commercial', 'Land', 'Other']
const purposes = ['Investment', 'Self-use', 'Business', 'Other']
const timelines = ['Within 1 month', '1-3 months', '3-6 months', 'More than 6 months']

const exportColumns = [
  'lead_no', 'created_at', 'name', 'phone', 'alt_phone', 'source', 'campaign',
  'ad_set', 'ad', 'property_type', 'preferred_location', 'budget', 'purpose',
  'timeline', 'status', 'quality', 'score', 'next_followup_at', 'notes',
]

const sampleCsv =
  'name,phone,alt_phone,source,campaign,ad_set,ad,property_type,preferred_location,budget,purpose,timeline,notes\n' +
  'Sample Buyer,9123456780,,Meta,Diwali Campaign,Indore Plots,Video Ad 1,Plot,Indore,2500000,Investment,Within 1 month,Asked for brochure\n'

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  const t = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ''))
}

function csvCell(v: unknown) {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return '"' + s.replace(/"/g, '""') + '"'
}

function download(filename: string, text: string) {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function pick(value: string, allowed: string[]) {
  const found = allowed.find((a) => a.toLowerCase() === value.trim().toLowerCase())
  return found ?? null
}

export default function DataTools() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<string[]>([])

  async function exportLeads(format: 'csv' | 'xlsx') {
    setBusy(true)
    setError('')
    setMessages([])
    try {
      const all: Record<string, unknown>[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error: err } = await supabase
          .from('leads')
          .select(exportColumns.join(', '))
          .order('lead_no', { ascending: true })
          .range(from, from + 999)
        if (err) throw new Error(err.message)
        const rows = (data ?? []) as unknown as Record<string, unknown>[]
        all.push(...rows)
        if (rows.length < 1000) break
      }
      const day = new Date().toISOString().slice(0, 10)
      if (format === 'xlsx') {
        await downloadXlsx('leads-' + day + '.xlsx', 'Leads', exportColumns, all)
      } else {
        const lines = [exportColumns.join(',')]
        all.forEach((r) => lines.push(exportColumns.map((c) => csvCell(r[c])).join(',')))
        download('leads-' + day + '.csv', lines.join('\n'))
      }
      setMessages(['Exported ' + all.length + ' leads.'])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
    setBusy(false)
  }

  async function importFile(file: File) {
    setBusy(true)
    setError('')
    setMessages([])
    try {
      const rows = parseCsv(await file.text())
      if (rows.length < 2) throw new Error('The file is empty or has no data rows.')
      if (rows.length > 2001) throw new Error('Please import at most 2000 leads at a time.')

      const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
      const col = (name: string) => header.indexOf(name)
      if (col('name') < 0 || col('phone') < 0) {
        throw new Error('The first row must have "name" and "phone" columns.')
      }
      const get = (r: string[], name: string) => {
        const i = col(name)
        return i >= 0 ? (r[i] ?? '').trim() : ''
      }

      const invalid: string[] = []
      const seen = new Set<string>()
      let fileDuplicates = 0
      const valid: { name: string; phone: string; row: string[] }[] = []

      rows.slice(1).forEach((r, i) => {
        const name = get(r, 'name')
        const phone = get(r, 'phone').replace(/\D/g, '').slice(-10)
        if (!name || phone.length !== 10) {
          invalid.push('row ' + (i + 2))
          return
        }
        if (seen.has(phone)) {
          fileDuplicates++
          return
        }
        seen.add(phone)
        valid.push({ name, phone, row: r })
      })

      const existing = new Set<string>()
      const phones = valid.map((v) => v.phone)
      for (let i = 0; i < phones.length; i += 200) {
        const { data, error: err } = await supabase
          .from('leads')
          .select('phone')
          .in('phone', phones.slice(i, i + 200))
        if (err) throw new Error(err.message)
        ;(data ?? []).forEach((d) => existing.add(d.phone))
      }
      const fresh = valid.filter((v) => !existing.has(v.phone))

      const { data: { user } } = await supabase.auth.getUser()
      const followup = new Date()
      followup.setDate(followup.getDate() + 1)
      followup.setHours(10, 0, 0, 0)

      const payloads = fresh.map((v) => {
        const r = v.row
        const budgetNum = Number(get(r, 'budget').replace(/[^0-9.]/g, ''))
        const budget = budgetNum > 0 ? budgetNum : null
        const property_type = pick(get(r, 'property_type'), types)
        const purpose = pick(get(r, 'purpose'), purposes)
        const timeline = pick(get(r, 'timeline'), timelines)
        const preferred_location = get(r, 'preferred_location') || null
        const { score, quality } = calculateScore({
          budget, property_type, preferred_location, purpose, timeline, status: 'New',
        })
        return {
          name: v.name,
          phone: v.phone,
          alt_phone: get(r, 'alt_phone').replace(/\D/g, '').slice(-10) || null,
          source: pick(get(r, 'source'), sources) ?? 'Other',
          campaign: get(r, 'campaign') || null,
          ad_set: get(r, 'ad_set') || null,
          ad: get(r, 'ad') || null,
          property_type,
          preferred_location,
          budget,
          purpose,
          timeline,
          notes: get(r, 'notes') || null,
          status: 'New',
          score,
          quality,
          assigned_to: user?.id ?? null,
          next_followup_at: followup.toISOString(),
          followup_type: 'Call',
          followup_note: 'First call to the imported lead',
        }
      })

      let imported = 0
      for (let i = 0; i < payloads.length; i += 100) {
        const { data, error: err } = await supabase
          .from('leads')
          .insert(payloads.slice(i, i + 100))
          .select('id')
        if (err) throw new Error('Import stopped after ' + imported + ' leads: ' + err.message)
        const created = data ?? []
        imported += created.length
        const acts = await supabase.from('activities').insert(
          created.map((c) => ({
            lead_id: c.id,
            type: 'Lead created',
            detail: 'Imported from CSV',
            done_by: user?.id ?? null,
          }))
        )
        if (acts.error) throw new Error(acts.error.message)
      }

      const out = ['Imported: ' + imported + ' leads']
      const dupTotal = existing.size + fileDuplicates
      if (dupTotal > 0) out.push('Skipped duplicates (same phone number): ' + dupTotal)
      if (invalid.length > 0) {
        out.push(
          'Skipped rows with missing name or invalid phone: ' + invalid.length +
            ' (' + invalid.slice(0, 10).join(', ') + (invalid.length > 10 ? ', ...' : '') + ')'
        )
      }
      setMessages(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
    setBusy(false)
  }

  const card = 'rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20'
  const btn = 'ui-focus w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors disabled:opacity-60 '
  const btn2 = btn + 'border border-line bg-surface-2 text-slate-100 hover:bg-line'
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <div className={card + ' space-y-3'}>
        <div>
          <h2 className="text-base font-semibold text-slate-100">Export</h2>
          <p className="mt-1 text-sm text-muted">Download a backup of all leads.</p>
        </div>
        <button disabled={busy} onClick={() => exportLeads('csv')} className={btn + 'bg-accent text-white hover:bg-blue-500'}>
          {busy ? 'Please wait...' : 'Export Leads (CSV)'}
        </button>
        <button disabled={busy} onClick={() => exportLeads('xlsx')} className={btn2}>
          {busy ? 'Please wait...' : 'Export Leads (Excel)'}
        </button>
      </div>
      <div className={card + ' space-y-3'}>
        <div>
          <h2 className="text-base font-semibold text-slate-100">Import</h2>
          <p className="mt-1 text-sm text-muted">Import leads from a CSV file. Leads with a phone number that already exists are skipped.</p>
        </div>
        <button disabled={busy} onClick={() => download('sample-leads.csv', sampleCsv)} className={btn2}>Download Sample File</button>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Import Leads (CSV file)</span>
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importFile(f)
              e.target.value = ''
            }}
            className="ui-focus w-full rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-slate-100"
          />
        </label>
        {error && <p className="text-danger">{error}</p>}
        {messages.length > 0 && (
          <div className="space-y-1 rounded-lg border border-green-900 bg-success-soft p-3">
            {messages.map((m) => (<p key={m} className="text-sm text-green-300">{m}</p>))}
          </div>
        )}
      </div>
    </div>
  )
}
