'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { SCORING_RULES, DEFAULT_RULES, applyRules, calculateScore } from '@/lib/scoring'

const supabase = createClient()

type Rules = typeof SCORING_RULES
type NumKey =
  | 'budgetGiven' | 'propertyClear' | 'locationClear' | 'purposeClear' | 'callConnected'
  | 'invalidNumber' | 'noResponse' | 'attemptsBeforeNoResponse' | 'notInterested'
  | 'bestFrom' | 'goodFrom' | 'mediumFrom'

const flat: [NumKey, string][] = [
  ['budgetGiven', 'Budget given'],
  ['propertyClear', 'Property or project is clear'],
  ['locationClear', 'Preferred location is clear'],
  ['purposeClear', 'Purpose is clear'],
  ['callConnected', 'Last call was connected'],
  ['invalidNumber', 'Invalid number (use a minus number)'],
  ['noResponse', 'No response after many calls (use a minus number)'],
  ['attemptsBeforeNoResponse', 'Call attempts before "no response"'],
  ['notInterested', 'Not Interested or Lost (use a minus number)'],
]

const levels: [NumKey, string][] = [
  ['bestFrom', 'Best quality starts at score'],
  ['goodFrom', 'Good quality starts at score'],
  ['mediumFrom', 'Medium quality starts at score'],
]

const box = 'w-24 border rounded-xl px-3 py-2 text-base bg-white text-right'

function clone(r: Rules): Rules {
  return JSON.parse(JSON.stringify(r)) as Rules
}

function Row({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-700">{label}</span>
      <input
        type="number"
        className={box}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </div>
  )
}

export default function ScoringRulesPage() {
  const [rules, setRules] = useState<Rules>(clone(SCORING_RULES))
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setIsAdmin(me?.role === 'admin')
      const { data } = await supabase.from('settings').select('value').eq('key', 'scoring').maybeSingle()
      if (data && data.value) applyRules(data.value as Record<string, unknown>)
      setRules(clone(SCORING_RULES))
    }
    load()
  }, [])

  function setNum(key: NumKey, n: number) {
    setRules((r) => ({ ...r, [key]: n }))
  }
  function setNested(group: 'timeline' | 'status', k: string, n: number) {
    setRules((r) => ({ ...r, [group]: { ...r[group], [k]: n } }))
  }

  async function save() {
    setError('')
    setMessage('')
    if (!(rules.bestFrom > rules.goodFrom && rules.goodFrom > rules.mediumFrom)) {
      setError('Best must be higher than Good, and Good higher than Medium.')
      return
    }
    setBusy(true)
    const { error: err } = await supabase
      .from('settings')
      .upsert({ key: 'scoring', value: rules }, { onConflict: 'key' })
    if (err) {
      setError('Could not save: ' + err.message)
    } else {
      applyRules(rules as unknown as Record<string, unknown>)
      setMessage('Saved. New and edited leads will use these rules. Old leads keep their score until you recalculate.')
    }
    setBusy(false)
  }

  async function recalc() {
    setError('')
    setMessage('')
    setBusy(true)
    try {
      let changed = 0
      let total = 0
      for (let from = 0; ; from += 1000) {
        const { data, error: err } = await supabase
          .from('leads')
          .select('id, budget, property_id, property_type, location, preferred_location, purpose, timeline, status, call_attempts, last_call_status, score, quality')
          .order('lead_no', { ascending: true })
          .range(from, from + 999)
        if (err) throw new Error(err.message)
        const rows = data ?? []
        total += rows.length
        const todo = rows.filter((l) => {
          const r = calculateScore(l)
          return r.score !== l.score || r.quality !== l.quality
        })
        for (let i = 0; i < todo.length; i += 20) {
          const chunk = todo.slice(i, i + 20)
          const results = await Promise.all(
            chunk.map((l) => {
              const r = calculateScore(l)
              return supabase.from('leads').update({ score: r.score, quality: r.quality }).eq('id', l.id)
            })
          )
          const bad = results.find((x) => x.error)
          if (bad && bad.error) throw new Error(bad.error.message)
          changed += chunk.length
        }
        if (rows.length < 1000) break
      }
      setMessage('Checked ' + total + ' leads, updated ' + changed + '.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
    setBusy(false)
  }

  if (isAdmin === null) return <p className="text-slate-500">Loading...</p>
  if (!isAdmin) {
    return (
      <div>
        <Link href="/settings" className="text-blue-600">&larr; Back to Settings</Link>
        <p className="mt-4 text-slate-700">Only an admin can change the scoring rules.</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <Link href="/settings" className="text-blue-600">&larr; Back to Settings</Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-3 mb-1">Scoring Rules</h1>
      <p className="text-sm text-slate-500 mb-4">
        The score is only a priority indicator. It does not predict who will buy.
      </p>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3 mb-4">
        <h2 className="font-semibold text-slate-800">Points</h2>
        {flat.map(([k, label]) => (
          <Row key={k} label={label} value={rules[k] as number} onChange={(n) => setNum(k, n)} />
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3 mb-4">
        <h2 className="font-semibold text-slate-800">When do they plan to buy?</h2>
        {Object.keys(rules.timeline).map((k) => (
          <Row key={k} label={k} value={rules.timeline[k]} onChange={(n) => setNested('timeline', k, n)} />
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3 mb-4">
        <h2 className="font-semibold text-slate-800">Lead status</h2>
        {Object.keys(rules.status).map((k) => (
          <Row key={k} label={k} value={rules.status[k]} onChange={(n) => setNested('status', k, n)} />
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow p-4 space-y-3 mb-4">
        <h2 className="font-semibold text-slate-800">Quality levels</h2>
        {levels.map(([k, label]) => (
          <Row key={k} label={label} value={rules[k] as number} onChange={(n) => setNum(k, n)} />
        ))}
      </div>

      {error && <p className="text-red-600 mb-3">{error}</p>}
      {message && <p className="text-green-700 mb-3">{message}</p>}

      <div className="space-y-2">
        <button disabled={busy} onClick={save}
          className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
          {busy ? 'Please wait...' : 'Save Rules'}
        </button>
        <button disabled={busy} onClick={recalc}
          className="w-full bg-slate-100 text-slate-800 rounded-xl py-3 font-semibold disabled:opacity-60">
          Recalculate all lead scores (save first)
        </button>
        <button disabled={busy} onClick={() => setRules(clone(DEFAULT_RULES))}
          className="w-full bg-slate-100 text-slate-800 rounded-xl py-3 font-semibold disabled:opacity-60">
          Reset to default points (then press Save)
        </button>
      </div>
    </div>
  )
}