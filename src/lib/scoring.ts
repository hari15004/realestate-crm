// Simple lead scoring.
// This is only a priority indicator for the sales team.
// It does NOT predict whether a lead will actually buy.

import { createClient } from '@/lib/supabase/client'

export type ScoreInput = {
  budget?: number | null
  property_id?: string | null
  property_type?: string | null
  location?: string | null
  preferred_location?: string | null
  purpose?: string | null
  timeline?: string | null
  status?: string | null
  call_attempts?: number | null
  last_call_status?: string | null
}

export type Quality = 'Best' | 'Good' | 'Medium' | 'Poor'

// Default points. An admin can change them from Settings > Scoring rules.
export const SCORING_RULES = {
  budgetGiven: 15,
  propertyClear: 10,
  locationClear: 10,
  purposeClear: 10,
  callConnected: 15,
  timeline: {
    'Within 1 month': 20,
    '1-3 months': 15,
    '3-6 months': 8,
  } as Record<string, number>,
  status: {
    Interested: 15,
    'Follow-up': 5,
    'Site Visit Planned': 25,
    'Site Visit Done': 35,
    Negotiation: 45,
    Booked: 60,
    Sold: 60,
  } as Record<string, number>,
  invalidNumber: -50,
  noResponse: -20,
  attemptsBeforeNoResponse: 3,
  notInterested: -100,
  bestFrom: 70,
  goodFrom: 45,
  mediumFrom: 25,
}

export const DEFAULT_RULES = JSON.parse(JSON.stringify(SCORING_RULES)) as typeof SCORING_RULES

// Copies saved numbers on top of the current rules. Unknown keys are ignored.
export function applyRules(saved: Record<string, unknown>) {
  const r = SCORING_RULES as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(saved)) {
    if (!(key in r)) continue
    if (typeof value === 'number' && typeof r[key] === 'number') {
      r[key] = value
    } else if (value && typeof value === 'object' && r[key] && typeof r[key] === 'object') {
      const target = r[key] as Record<string, number>
      for (const [k2, v2] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v2 === 'number') target[k2] = v2
      }
    }
  }
}

let loaded = false

// Browser only: reads the saved rules once from the settings table.
export async function loadScoringRules() {
  if (loaded) return
  loaded = true
  try {
    const { data } = await createClient()
      .from('settings')
      .select('value')
      .eq('key', 'scoring')
      .maybeSingle()
    if (data && data.value) applyRules(data.value as Record<string, unknown>)
  } catch {
    // keep the default rules if anything goes wrong
  }
}

if (typeof window !== 'undefined') {
  void loadScoringRules()
}

export function calculateScore(lead: ScoreInput): { score: number; quality: Quality } {
  const r = SCORING_RULES
  let score = 0

  if (lead.budget && lead.budget > 0) score += r.budgetGiven
  if (lead.property_id || lead.property_type) score += r.propertyClear
  if (lead.location || lead.preferred_location) score += r.locationClear
  if (lead.purpose) score += r.purposeClear
  if (lead.timeline) score += r.timeline[lead.timeline] ?? 0
  if (lead.status) score += r.status[lead.status] ?? 0

  if (lead.last_call_status === 'Connected') score += r.callConnected
  if (lead.last_call_status === 'Invalid number') score += r.invalidNumber

  const attempts = lead.call_attempts ?? 0
  const neverConnected = lead.last_call_status !== 'Connected'
  if (attempts >= r.attemptsBeforeNoResponse && neverConnected) score += r.noResponse

  if (lead.status === 'Not Interested' || lead.status === 'Lost') score += r.notInterested

  score = Math.max(0, Math.min(100, score))

  let quality: Quality = 'Poor'
  if (score >= r.bestFrom) quality = 'Best'
  else if (score >= r.goodFrom) quality = 'Good'
  else if (score >= r.mediumFrom) quality = 'Medium'

  return { score, quality }
}