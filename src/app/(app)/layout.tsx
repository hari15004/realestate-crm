'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()

const icons: Record<string, string> = {
  '/': 'M3 10.5L12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  '/leads': 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  '/followups': 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  '/site-visits': 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  '/properties': 'M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M14 9h1M14 13h1',
  '/reports': 'M18 20V10M12 20V4M6 20v-6',
  '/settings': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
}

const groups = [
  { title: 'Workspace', links: [
    { href: '/', label: 'Dashboard' },
    { href: '/leads', label: 'Leads' },
    { href: '/followups', label: 'Follow-ups' },
    { href: '/site-visits', label: 'Site Visits' },
  ] },
  { title: 'Business', links: [
    { href: '/properties', label: 'Properties' },
    { href: '/reports', label: 'Reports' },
  ] },
  { title: 'System', links: [{ href: '/settings', label: 'Settings' }] },
]
const links = groups.flatMap((g) => g.links)

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.auth.getSession()
      const uid = s.session?.user.id
      if (!uid) return
      const { data } = await supabase.from('profiles').select('full_name, role').eq('id', uid).single()
      setName((data?.full_name as string) ?? '')
      setRole((data?.role as string) ?? '')
    }
    load()
  }, [])

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initial = (name || '?').charAt(0).toUpperCase()
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : ''

  return (
    <div className="min-h-screen bg-canvas md:flex">
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-line bg-surface p-4">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-bold text-slate-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
            <Icon d={icons['/']} />
          </span>
          Real Estate CRM
        </div>
        <nav className="flex flex-1 flex-col gap-4" aria-label="Main">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{g.title}</p>
              {g.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    'ui-focus flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ' +
                    (isActive(l.href) ? 'bg-accent text-white' : 'text-slate-300 hover:bg-surface-2')
                  }
                >
                  <Icon d={icons[l.href]} />
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft font-semibold text-blue-300">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{name || 'User'}</p>
              <p className="text-xs text-muted">{roleLabel}</p>
            </div>
          </div>
          <button onClick={logout} className="ui-focus w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-surface-2">
            Logout
          </button>
        </div>
      </aside>

      <div className="sticky top-0 z-10 border-b border-line bg-surface md:hidden">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="font-bold text-slate-100">Real Estate CRM</span>
          <button onClick={logout} className="ui-focus text-sm text-slate-300">Logout</button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 py-3" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                'ui-focus flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ' +
                (isActive(l.href) ? 'bg-accent text-white' : 'bg-surface-2 text-slate-300')
              }
            >
              <Icon d={icons[l.href]} />
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  )
}