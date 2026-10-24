import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { calculateScore } from '@/lib/scoring'

export const runtime = 'nodejs'

const closed = ['Booked', 'Sold', 'Not Interested', 'Lost']

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

type Db = ReturnType<typeof admin>
type Field = { name: string; values: string[] }

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const token = process.env.META_VERIFY_TOKEN
  if (token && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === token) {
    return new NextResponse(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

function validSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET
  if (!secret || !header) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(header)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function pickAssignee(db: Db): Promise<string | null> {
  const { data: team } = await db.from('profiles').select('id').in('role', ['sales', 'admin'])
  if (!team || team.length === 0) return null
  const { data: open } = await db
    .from('leads')
    .select('assigned_to')
    .not('status', 'in', '(' + closed.map((s) => '"' + s + '"').join(',') + ')')
    .not('assigned_to', 'is', null)
  const counts: Record<string, number> = {}
  team.forEach((t) => { counts[t.id as string] = 0 })
  ;(open ?? []).forEach((l) => {
    const a = l.assigned_to as string
    if (a in counts) counts[a] += 1
  })
  let best = team[0].id as string
  team.forEach((t) => {
    if (counts[t.id as string] < counts[best]) best = t.id as string
  })
  return best
}

async function processLead(leadgenId: string) {
  const res = await fetch(
    'https://graph.facebook.com/' + leadgenId +
      '?access_token=' + encodeURIComponent(process.env.META_PAGE_ACCESS_TOKEN ?? '')
  )
  if (!res.ok) throw new Error('Meta Graph API error ' + res.status)
  const info = await res.json()
  const fields: Field[] = info.field_data ?? []
  const get = (...names: string[]) => {
    for (const n of names) {
      const f = fields.find((x) => x.name === n)
      if (f && f.values && f.values[0]) return f.values[0]
    }
    return ''
  }

  const name = get('full_name', 'name') || 'Meta Lead'
  const phone = get('phone_number', 'phone').replace(/\D/g, '').slice(-10)
  const email = get('email')
  if (phone.length !== 10) {
    console.error('Meta lead ' + leadgenId + ' skipped: no valid 10-digit phone')
    return
  }

  const db = admin()
  const { data: dup } = await db.from('leads').select('id').eq('phone', phone).limit(1)
  if (dup && dup.length > 0) {
    await db.from('activities').insert({
      lead_id: dup[0].id, type: 'Note',
      detail: 'This person submitted a Meta lead form again.', done_by: null,
    })
    return
  }

  const { score, quality } = calculateScore({
    budget: null, property_type: null, preferred_location: null,
    purpose: null, timeline: null, status: 'New',
  })
  const followup = new Date()
  followup.setDate(followup.getDate() + 1)
  followup.setHours(10, 0, 0, 0)

  const { data: lead, error } = await db.from('leads').insert({
    name, phone, source: 'Meta',
    campaign: info.campaign_name ?? null,
    ad_set: info.adset_name ?? null,
    ad: info.ad_name ?? null,
    notes: email ? 'Email: ' + email : null,
    score, quality, status: 'New',
    assigned_to: await pickAssignee(db),
    next_followup_at: followup.toISOString(),
    followup_type: 'Call',
    followup_note: 'First call to the new lead',
  }).select('id').single()
  if (error || !lead) throw new Error('Could not save lead: ' + (error?.message ?? 'unknown'))

  await db.from('activities').insert({
    lead_id: lead.id, type: 'Lead created', detail: 'Source: Meta Lead Ad', done_by: null,
  })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new NextResponse('Invalid signature', { status: 401 })
  }
  let body: { entry?: { changes?: { field?: string; value?: { leadgen_id?: string } }[] }[] }
  try {
    body = JSON.parse(raw)
  } catch {
    return new NextResponse('Bad request', { status: 400 })
  }
  const ids: string[] = []
  for (const e of body.entry ?? []) {
    for (const c of e.changes ?? []) {
      if (c.field === 'leadgen' && c.value?.leadgen_id) ids.push(String(c.value.leadgen_id))
    }
  }
  try {
    for (const id of ids) await processLead(id)
  } catch (e) {
    console.error('Meta webhook error', e)
    return new NextResponse('Error', { status: 500 })
  }
  return NextResponse.json({ ok: true, received: ids.length })
}