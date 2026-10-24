'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/followups', label: 'Follow-ups' },
  { href: '/site-visits', label: 'Site Visits' },
  { href: '/properties', label: 'Properties' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href)
  }

  async function logout() {
    await createClient().auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <aside className="hidden md:flex md:w-56 md:flex-col bg-white border-r p-4">
        <div className="text-lg font-bold text-blue-700 mb-6">Real Estate CRM</div>
        <nav className="flex flex-col gap-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                'rounded-xl px-4 py-3 text-base font-medium ' +
                (isActive(l.href)
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100')
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="rounded-xl px-4 py-3 text-left text-slate-600 hover:bg-slate-100"
        >
          Logout
        </button>
      </aside>

      <div className="md:hidden bg-white border-b sticky top-0 z-10">
        <div className="flex items-center justify-between px-4 pt-3">
          <span className="font-bold text-blue-700">Real Estate CRM</span>
          <button onClick={logout} className="text-sm text-slate-600">
            Logout
          </button>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-3 py-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                'whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ' +
                (isActive(l.href)
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700')
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 p-4 md:p-8">{children}</main>
    </div>
  )
}
