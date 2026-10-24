'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { calculateScore } from '@/lib/scoring'
import { pickAssignee } from '@/lib/autoAssign'

const input = 'w-full border rounded-xl px-4 py-3 text-base bg-white'
const sources = ['Meta', 'Instagram', 'Website', 'WhatsApp', 'Referral', 'Phone', 'Other']
const types = ['Plot', 'Flat/Apartment', 'Villa/House', 'Commercial', 'Land', 'Other']
const purposes = ['Investment', 'Self-use', 'Business', 'Other']
const timelines = ['Within 1 month', '1-3 months', '3-6 months', 'More than 6 months']
const payments = ['Cash', 'Home loan', 'Part cash + part loan', 'Not decided']
const interests = ['High', 'Medium', 'Low']

type Duplicate = { id: string; lead_no: number; name: string }
type Project = { id: string; name: string }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

export default function NewLeadPage() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '', phone: '', alt_phone: '', source: 'Phone', campaign: '', ad_set: '',
    ad: '', property_id: '', property_type: '', preferred_location: '', budget: '',
    purpose: '', timeline: '', payment_preference: '', interest_level: '', notes: '',
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase
      .from('properties')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data }) => setProjects((data ?? []) as Project[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function merge() {
    if (!duplicate) return
    setSaving(true)
    setError('')
    const { data: old, error: e1 } = await supabase
      .from('leads').select('*').eq('id', duplicate.id).single()
    if (e1 || !old) {
      setError('Could not load the existing lead: ' + (e1?.message ?? 'not found'))
      setSaving(false)
      return
    }
    const row = old as Record<string, unknown>
    const changes: Record<string, unknown> = {}
    const textFields = [
      'alt_phone', 'campaign', 'ad_set', 'ad', 'property_id', 'property_type',
      'preferred_location', 'purpose', 'timeline', 'payment_preference', 'interest_level',
    ] as const
    textFields.forEach((k) => {
      const mine = form[k]
      if (mine && !row[k]) changes[k] = mine
    })
    if (form.budget && !row.budget) changes.budget = Number(form.budget)
    if (form.notes.trim()) {
      const prev = row.notes ? String(row.notes) + '\n' : ''
      changes.notes = prev + form.notes.trim()
    }
    const merged = { ...row, ...changes }
    const { score, quality } = calculateScore(merged)
    const { error: e2 } = await supabase
      .from('leads').update({ ...changes, score, quality }).eq('id', duplicate.id)
    if (e2) {
      setError('Could not merge: ' + e2.message)
      setSaving(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activities').insert({
      lead_id: duplicate.id,
      type: 'Merged',
      detail: 'Same phone number was added again (' + form.name + '). Empty fields were filled and notes were added.',
      done_by: user?.id ?? null,
    })
    router.push('/leads/' + duplicate.id)
    router.refresh()
  }

  async function save(force: boolean) {
    setSaving(true)
    setError('')
    const phone = form.phone.replace(/\D/g, '').slice(-10)
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      setSaving(false)
      return
    }
    if (!force) {
      const { data: dup } = await supabase
        .from('leads').select('id, lead_no, name').eq('phone', phone).limit(1)
      if (dup && dup.length > 0) {
        setDuplicate(dup[0])
        setSaving(false)
        return
      }
    }
    const budget = form.budget ? Number(form.budget) : null
    const { score, quality } = calculateScore({
      budget,
      property_type: form.property_type || null,
      preferred_location: form.preferred_location || null,
      purpose: form.purpose || null,
      timeline: form.timeline || null,
      status: 'New',
    })
    const { data: { user } } = await supabase.auth.getUser()
    const followup = new Date()
    followup.setDate(followup.getDate() + 1)
    followup.setHours(10, 0, 0, 0)

    const { data: lead, error: err } = await supabase.from('leads').insert({
      name: form.name,
      phone,
      alt_phone: form.alt_phone || null,
      source: form.source,
      campaign: form.campaign || null,
      ad_set: form.ad_set || null,
      ad: form.ad || null,
      property_id: form.property_id || null,
      property_type: form.property_type || null,
      preferred_location: form.preferred_location || null,
      budget,
      purpose: form.purpose || null,
      timeline: form.timeline || null,
      payment_preference: form.payment_preference || null,
      interest_level: form.interest_level || null,
      notes: form.notes || null,
      score,
      quality,
      status: 'New',
      assigned_to: await pickAssignee(supabase, user?.id ?? null),
      next_followup_at: followup.toISOString(),
      followup_type: 'Call',
      followup_note: 'First call to the new lead',
    }).select('id').single()

    if (err || !lead) {
      setError('Could not save the lead: ' + (err?.message ?? 'unknown error'))
      setSaving(false)
      return
    }
    await supabase.from('activities').insert({
      lead_id: lead.id, type: 'Lead created', detail: 'Source: ' + form.source,
      done_by: user?.id ?? null,
    })
    router.push('/leads')
    router.refresh()
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-800 mb-4">Add New Lead</h1>

      {duplicate && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-4 mb-4">
          <p className="font-medium text-yellow-900">
            This phone number already exists: Lead #{duplicate.lead_no} ({duplicate.name})
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button disabled={saving} onClick={merge} className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-60">
              Merge into existing lead
            </button>
            <button disabled={saving} onClick={() => save(true)} className="bg-yellow-600 text-white rounded-xl px-4 py-3 font-semibold disabled:opacity-60">
              Save anyway
            </button>
            <button disabled={saving} onClick={() => setDuplicate(null)} className="bg-white border rounded-xl px-4 py-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => { e.preventDefault(); save(false) }}
        className="bg-white rounded-2xl shadow p-4 md:p-6 space-y-4"
      >
        <Field label="Name *">
          <input required className={input} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Phone number *">
          <input required type="tel" className={input} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Alternate phone (optional)">
          <input type="tel" className={input} value={form.alt_phone} onChange={(e) => set('alt_phone', e.target.value)} />
        </Field>
        <Field label="Source">
          <select className={input} value={form.source} onChange={(e) => set('source', e.target.value)}>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <input className={input} value={form.campaign} onChange={(e) => set('campaign', e.target.value)} />
        </Field>
        <Field label="Ad Set">
          <input className={input} value={form.ad_set} onChange={(e) => set('ad_set', e.target.value)} />
        </Field>
        <Field label="Ad">
          <input className={input} value={form.ad} onChange={(e) => set('ad', e.target.value)} />
        </Field>
        <Field label="Project (optional)">
          <select className={input} value={form.property_id} onChange={(e) => set('property_id', e.target.value)}>
            <option value="">Not sure</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Property type">
          <select className={input} value={form.property_type} onChange={(e) => set('property_type', e.target.value)}>
            <option value="">Not sure</option>
            {types.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Preferred location">
          <input className={input} value={form.preferred_location} onChange={(e) => set('preferred_location', e.target.value)} />
        </Field>
        <Field label="Budget (in rupees, numbers only)">
          <input type="number" min="0" className={input} value={form.budget} onChange={(e) => set('budget', e.target.value)} />
        </Field>
        <Field label="Payment preference">
          <select className={input} value={form.payment_preference} onChange={(e) => set('payment_preference', e.target.value)}>
            <option value="">Not sure</option>
            {payments.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Interest level">
          <select className={input} value={form.interest_level} onChange={(e) => set('interest_level', e.target.value)}>
            <option value="">Not sure</option>
            {interests.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Purpose">
          <select className={input} value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
            <option value="">Not sure</option>
            {purposes.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="When do they plan to buy?">
          <select className={input} value={form.timeline} onChange={(e) => set('timeline', e.target.value)}>
            <option value="">Not sure</option>
            {timelines.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Notes">
          <textarea rows={3} className={input} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-base font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Lead'}
        </button>
      </form>
    </div>
  )
}