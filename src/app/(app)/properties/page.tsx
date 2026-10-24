'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const types = ['Plot', 'Flat/Apartment', 'Villa/House', 'Commercial', 'Land', 'Other']
const statuses = ['Active', 'Upcoming', 'Sold Out', 'Inactive']

const statusColor: Record<string, string> = {
  Active: 'bg-green-100 text-green-800',
  Upcoming: 'bg-blue-100 text-blue-800',
  'Sold Out': 'bg-slate-200 text-slate-700',
  Inactive: 'bg-slate-200 text-slate-700',
}

type Property = {
  id: string
  name: string
  location: string | null
  property_type: string | null
  starting_price: number | null
  available_units: number | null
  status: string
}

const emptyForm = {
  name: '',
  location: '',
  property_type: 'Plot',
  starting_price: '',
  available_units: '',
  status: 'Active',
}

const box = 'w-full border rounded-xl px-4 py-3 text-base bg-white'

function formatPrice(n: number | null) {
  if (!n) return '-'
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr+'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + ' L+'
  return '₹' + n + '+'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}

export default function PropertiesPage() {
  const [items, setItems] = useState<Property[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const [p, me] = await Promise.all([
      supabase
        .from('properties')
        .select('id, name, location, property_type, starting_price, available_units, status')
        .order('created_at', { ascending: false }),
      user
        ? supabase.from('profiles').select('role').eq('id', user.id).single()
        : Promise.resolve({ data: null, error: null }),
    ])
    if (p.error) setError('Could not load properties: ' + p.error.message)
    else {
      setError('')
      setItems((p.data ?? []) as Property[])
    }
    setIsAdmin(me.data?.role === 'admin')
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function startAdd() {
    setEditId('')
    setForm(emptyForm)
    setShowForm(true)
    setError('')
  }

  function startEdit(p: Property) {
    setEditId(p.id)
    setForm({
      name: p.name,
      location: p.location ?? '',
      property_type: p.property_type ?? 'Plot',
      starting_price: p.starting_price ? String(p.starting_price) : '',
      available_units: p.available_units !== null ? String(p.available_units) : '',
      status: p.status,
    })
    setShowForm(true)
    setError('')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      property_type: form.property_type || null,
      starting_price: form.starting_price ? Number(form.starting_price) : null,
      available_units: form.available_units ? Number(form.available_units) : null,
      status: form.status,
    }
    const res = editId
      ? await supabase.from('properties').update(payload).eq('id', editId)
      : await supabase.from('properties').insert(payload)
    if (res.error) {
      setError('Could not save: ' + res.error.message)
      setSaving(false)
      return
    }
    setShowForm(false)
    setEditId('')
    setForm(emptyForm)
    setSaving(false)
    await load()
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Properties</h1>
        {isAdmin && !showForm && (
          <button onClick={startAdd} className="bg-blue-600 text-white rounded-xl px-4 py-3 font-semibold">
            + Add Project
          </button>
        )}
      </div>

      {!isAdmin && !loading && (
        <p className="text-slate-500 mb-4">Only the admin can add or edit projects.</p>
      )}

      {error && <p className="text-red-600 mb-3">{error}</p>}

      {isAdmin && showForm && (
        <form onSubmit={save} className="bg-white rounded-2xl shadow p-4 md:p-6 space-y-4 mb-6">
          <p className="font-semibold text-slate-800">{editId ? 'Edit Project' : 'New Project'}</p>
          <Field label="Project name *">
            <input required className={box} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Location">
            <input className={box} value={form.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Property type">
            <select className={box} value={form.property_type} onChange={(e) => set('property_type', e.target.value)}>
              {types.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Starting price (in rupees, numbers only)">
            <input type="number" min="0" className={box} value={form.starting_price}
              onChange={(e) => set('starting_price', e.target.value)} />
          </Field>
          <Field label="Available units / plots (optional)">
            <input type="number" min="0" className={box} value={form.available_units}
              onChange={(e) => set('available_units', e.target.value)} />
          </Field>
          <Field label="Status">
            <select className={box} value={form.status} onChange={(e) => set('status', e.target.value)}>
              {statuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <button type="submit" disabled={saving}
              className="bg-blue-600 text-white rounded-xl py-3 font-semibold disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Project'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId('') }}
              className="bg-slate-100 text-slate-800 rounded-xl py-3 font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="text-slate-500">Loading...</p>}
      {!loading && items.length === 0 && <p className="text-slate-500">No projects yet.</p>}

      <div className="space-y-3">
        {items.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-slate-800">{p.name}</p>
                <p className="text-sm text-slate-500">
                  {p.property_type ?? '-'} · {p.location ?? '-'}
                </p>
              </div>
              <span className={'rounded-full px-3 py-1 text-sm font-medium ' + (statusColor[p.status] ?? '')}>
                {p.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-slate-600">
              <span>Starting price: <b>{formatPrice(p.starting_price)}</b></span>
              <span>Available units: <b>{p.available_units ?? '-'}</b></span>
            </div>
            {isAdmin && (
              <button onClick={() => startEdit(p)}
                className="mt-3 w-full bg-slate-100 text-slate-800 rounded-xl py-3 font-semibold">
                Edit
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
