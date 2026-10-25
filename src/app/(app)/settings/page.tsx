'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

export default function SettingsPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase.auth.getUser()
      const user = u.user
      if (!user) return
      setEmail(user.email ?? '')
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
      setName((data?.full_name as string) ?? '')
      setRole((data?.role as string) ?? '')
    }
    load()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const card = 'rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20 md:p-6'
  const btn = 'ui-focus rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-center text-sm font-semibold text-slate-100 transition-colors hover:bg-line'
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
      <p className="mb-4 text-sm text-muted">Your account and scoring rules</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 text-base font-semibold text-slate-100">Account</h2>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-blue-300">
              {(name || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-100">{name || 'User'}</p>
              <p className="truncate text-sm text-muted">{email}</p>
              <p className="text-sm text-muted">Role: {role ? role.charAt(0).toUpperCase() + role.slice(1) : '-'}</p>
            </div>
          </div>
          <button onClick={logout} className={btn + ' w-full'}>Logout</button>
        </div>
        <div className={card}>
          <h2 className="text-base font-semibold text-slate-100">Scoring Rules</h2>
          <p className="mb-3 mt-1 text-sm text-muted">Edit how lead scores and quality are calculated (admin only).</p>
          <a href="/settings/scoring" className={btn + ' block'}>Scoring Rules (admin)</a>
        </div>
      </div>
    </div>
  )
}
