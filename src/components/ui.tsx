import Link from 'next/link'
import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={'rounded-xl border border-line bg-surface p-4 shadow-sm shadow-black/20 ' + className}>
      {children}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'success' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-blue-500',
  secondary: 'bg-surface-2 text-slate-100 border border-line hover:bg-line',
  success: 'bg-success text-black hover:bg-green-400',
  danger: 'bg-danger text-white hover:bg-red-400',
}

const btnBase =
  'ui-focus inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors'

export function Button({
  children, variant = 'primary', className = '', ...rest
}: { children: ReactNode; variant?: Variant; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={btnBase + ' ' + variants[variant] + ' ' + className + ' disabled:opacity-60'} {...rest}>
      {children}
    </button>
  )
}

export function ButtonLink({
  href, children, variant = 'primary', className = '',
}: { href: string; children: ReactNode; variant?: Variant; className?: string }) {
  const isPhone = href.startsWith('tel:')
  const cls = btnBase + ' ' + variants[variant] + ' ' + className
  return isPhone ? (
    <a href={href} className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  )
}

type Tone = 'neutral' | 'accent' | 'success' | 'danger' | 'warn' | 'violet'

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-slate-300 border-line',
  accent: 'bg-accent-soft text-blue-300 border-blue-900',
  success: 'bg-success-soft text-green-300 border-green-900',
  danger: 'bg-danger-soft text-red-300 border-red-900',
  warn: 'bg-warn-soft text-amber-300 border-amber-900',
  violet: 'bg-surface-2 text-violet border-line',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ' + tones[tone]}>
      {children}
    </span>
  )
}

const qualityTone: Record<string, Tone> = { Best: 'success', Good: 'accent', Medium: 'warn', Poor: 'neutral' }

export function QualityBadge({ quality, score }: { quality: string; score?: number }) {
  return <Badge tone={qualityTone[quality] ?? 'neutral'}>{quality}{score !== undefined ? ' (' + score + ')' : ''}</Badge>
}

const statusTone: Record<string, Tone> = {
  New: 'accent', Contacted: 'accent', Interested: 'accent', 'Follow-up': 'warn',
  'Site Visit Planned': 'violet', 'Site Visit Done': 'violet', Negotiation: 'warn',
  Booked: 'success', Sold: 'success', 'Not Interested': 'neutral', Lost: 'danger',
}

export function StatusPill({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'neutral'}>{status}</Badge>
}

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
      {message}
    </div>
  )
}

export function Loading({ label = 'Loading...' }: { label?: string }) {
  return <p className="py-6 text-sm text-muted" role="status">{label}</p>
}