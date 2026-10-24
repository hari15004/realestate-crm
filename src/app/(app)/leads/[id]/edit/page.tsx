'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calculateScore } from '@/lib/scoring'

const supabase = createClient()

const box = 'w-full border rounded-xl px-4 py-3 text-base bg-white'
const sources = ['Meta', 'Instagram', 'Website', 'WhatsApp', 'Referral', 'Phone', 'Other']
const types = ['Plot', 'Flat/Apartment', 'Villa/House', 'Commercial', 'Land', 'Other']
const purposes = ['Investment', 'Self-use', 'Business', 'Other']
const timelines = ['Within 1 month', '1-3 months', '3-6 months', 'More than 6 months']
const payments = ['Cash', 'Home loan', 'Part cash + part loan', 'Not decided']
const interests = ['High', 'Medium', 'Low']

type Option = { id: string; name: string }
type Form = Record<string, string>

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

export default function EditLeadPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()

  const [form, setForm] = useState<Form | null>(null)
  const [status, setStatus] = useState('New')
  const [origPhone, setOrigPhone] = useState('')
  const [origAssigned, setOrigAssigned] = useState('')
  const [people, setPeople] = useState<Option[]>([])
  const [projects, setProjects] = useState<Option[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [l, p, pr] = await Promise.all([
        supabase.from('leads').select('*').eq('id', id).single(),
        supabase.from('profiles').select('id, full_name'),
        supabase.from('properties').select('id, name').order('name', { ascending: true }),
      ])
      if (l.error || !l.data) {
        setError('Could not load this lead: ' + (l.error?.message ?? 'not found'))
        return
      }
      const d = l.data as Record<string, unknown>
      const s = (k: string) => (d[k] === null || d[k] === undefined ? '' : String(d[k]))
      setForm({
        name: s('name'), phone: s('phone'), alt_phone: s('alt_phone'), source: s('source'),
        campaign: s('campaign'), ad_set: s('ad_set'), ad: s('ad'), property_id: s('property_id'),
        property_type: s('property_type'), preferred_location: s('preferred_location'),
        budget: s('budget'), purpose: s('purpose'), timeline: s('timeline'), notes: s('notes'),
        assigned_to: s('assigned_to'),
        payment_preference: s('payment_preference'), interest_level: s('interest_level'),
      })
      setStatus(s('status') || 'New')
      setOrigPhone(s('phone'))
      setOrigAssigned(s('assigned_to'))
      setPeople(
        (p.data ?? []).map((x) => ({ id: x.id as string, name: (x.full_name as string) || 'Unknown' }))
      )
      setProjects((pr.data ?? []) as Option[])
    }
    load()
  }, [id])

  function set(key: string, value: string) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    if (!form.name.trim()) {
      setError('Please enter a name')
      setSaving(false)
      return
    }
    const phone = form.phone.replace(/\D/g, '').slice(-10)
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number')
      setSaving(false)
      return
    }
    if (phone !== origPhone) {
      const { data: dup } = await supabase
        .from('leads').select('lead_no, name').eq('phone', phone).neq('id', id).limit(1)
      if (dup && dup.length > 0) {
        setError('This phone number already belongs to Lead #' + dup[0].lead_no + ' (' + dup[0].name + ')')
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
      status,
    })
    const { error: err } = await supabase
      .from('leads')
      .update({
        name: form.name.trim(),
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
        notes: form.notes || null,
        payment_preference: form.payment_preference || null,
        interest_level: form.interest_level || null,
        assigned_to: form.assigned_to || null,
        score,
        quality,
      })
      .eq('id', id)
    if (err) {
      setError('Could not save: ' + err.message)
      setSaving(false)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activities').insert({
      lead_id: id, type: 'Lead edited', detail: 'Lead details updated', done_by: user?.id ?? null,
    })
    if ((form.assigned_to || '') !== origAssigned) {
      const who = people.find((x) => x.id === form.assigned_to)?.name ?? 'Unassigned'
      await supabase.from('activities').insert({
        lead_id: id, type: 'Reassigned', detail: 'Assigned to ' + who, done_by: user?.id ?? null,
      })
    }
    router.push('/leads/' + id)
    router.refresh()
  }

  if (!form) {
    return (
      <div>
        <Link href={'/leads/' + id} className="text-blue-600">&larr; Back to Lead</Link>
        <p className={'mt-4 ' + (error ? 'text-red-600' : 'text-slate-500')}>{error || 'Loading...'}</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <Link href={'/leads/' + id} className="text-blue-600">&larr; Back to Lead</Link>
      <h1 className="text-2xl font-bold text-slate-800 mt-3 mb-4">Edit Lead</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); save() }}
        className="bg-white rounded-2xl shadow p-4 md:p-6 space-y-4"
      >
        <Field label="Assigned to">
          <select className={box} value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)}>
            <option value="">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Name *">
          <input required className={box} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Phone number *">
          <input required type="tel" className={box} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Alternate phone (optional)">
          <input type="tel" className={box} value={form.alt_phone} onChange={(e) => set('alt_phone', e.target.value)} />
        </Field>
        <Field label="Source">
          <select className={box} value={form.source} onChange={(e) => set('source', e.target.value)}>
            {sources.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Campaign">
          <input className={box} value={form.campaign} onChange={(e) => set('campaign', e.target.value)} />
        </Field>
        <Field label="Ad Set">
          <input className={box} value={form.ad_set} onChange={(e) => set('ad_set', e.target.value)} />
        </Field>
        <Field label="Ad">
          <input className={box} value={form.ad} onChange={(e) => set('ad', e.target.value)} />
        </Field>
        <Field label="Project (optional)">
          <select className={box} value={form.property_id} onChange={(e) => set('property_id', e.target.value)}>
            <option value="">Not sure</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Property type">
          <select className={box} value={form.property_type} onChange={(e) => set('property_type', e.target.value)}>
            <option value="">Not sure</option>
            {types.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Preferred location">
          <input className={box} value={form.preferred_location} onChange={(e) => set('preferred_location', e.target.value)} />
        </Field>
        <Field label="Budget (in rupees, numbers only)">
          <input type="number" min="0" className={box} value={form.budget} onChange={(e) => set('budget', e.target.value)} />
        </Field>
        <Field label="Purpose">
          <select className={box} value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
            <option value="">Not sure</option>
            {purposes.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="When do they plan to buy?">
          <select className={box} value={form.timeline} onChange={(e) => set('timeline', e.target.value)}>
            <option value="">Not sure</option>
            {timelines.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Payment preference">
          <select className={box} value={form.payment_preference} onChange={(e) => set('payment_preference', e.target.value)}>
            <option value="">Not sure</option>
            {payments.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Interest level">
          <select className={box} value={form.interest_level} onChange={(e) => set('interest_level', e.target.value)}>
            <option value="">Not sure</option>
            {interests.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Notes">
          <textarea rows={3} className={box} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-xl py-3 text-base font-semibold disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}