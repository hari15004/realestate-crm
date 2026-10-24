// Simple lead scoring.
// This is only a priority indicator for the sales team.
// It does NOT predict whether a lead will actually buy.

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

// Change the points here to tune the scoring later.
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
