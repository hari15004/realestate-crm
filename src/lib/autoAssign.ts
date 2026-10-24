import { createClient } from '@/lib/supabase/client'

const closed = ['Booked', 'Sold', 'Not Interested', 'Lost']

export async function pickAssignee(
  supabase: ReturnType<typeof createClient>,
  fallback: string | null
): Promise<string | null> {
  const { data: team } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['sales', 'admin'])
  if (!team || team.length === 0) return fallback
  const { data: open } = await supabase
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
