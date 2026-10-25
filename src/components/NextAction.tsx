type Props = {
  status: string
  callAttempts: number | null
  lastCallStatus: string | null
  nextFollowupAt: string | null
  followupType: string | null
  budget: number | null
  purpose: string | null
  timeline: string | null
  lastActivityAt: string | null
}

const closed = ['Booked', 'Sold', 'Not Interested', 'Lost']

function getAction(p: Props): string {
  if (closed.includes(p.status)) return 'This lead is closed. No action needed.'
  if (!p.callAttempts) return 'Call this lead now. No call has been made yet.'
  if (p.lastCallStatus === 'Invalid number') return 'The number is invalid. Ask for another number or check the phone.'
  if (p.nextFollowupAt && new Date(p.nextFollowupAt).getTime() < Date.now())
    return 'Follow-up is overdue. Do the ' + (p.followupType || 'follow-up').toLowerCase() + ' now.'
  if (p.lastCallStatus === 'Not connected') return 'Last call was not connected. Call again or send a WhatsApp message.'
  if (p.status === 'Site Visit Planned') return 'Confirm the site visit with the customer.'
  if (p.status === 'Site Visit Done') return 'Ask for feedback. If interested, move the status to Negotiation.'
  if (p.status === 'Negotiation') return 'Follow up on the offer and try to close the booking.'
  if (!p.budget || !p.purpose || !p.timeline) return 'Ask about budget, purpose and buying timeline. Save them in Edit Lead.'
  if (!p.nextFollowupAt) return 'Set the next follow-up date.'
  if (p.lastActivityAt) {
    const days = Math.floor((Date.now() - new Date(p.lastActivityAt).getTime()) / 86400000)
    if (days >= 2) return 'No contact for ' + days + ' days. Call this lead now.'
  }
  return 'All good. The next follow-up is already scheduled.'
}

export default function NextAction(p: Props) {
  return (
    <div className="bg-white rounded-2xl shadow p-4 mb-4 border border-blue-500">
      <p className="text-xs font-semibold text-blue-600 uppercase">Do this now</p>
      <p className="text-base font-semibold text-slate-800 mt-1">{getAction(p)}</p>
    </div>
  )
}
