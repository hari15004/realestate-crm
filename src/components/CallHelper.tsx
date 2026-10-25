type Props = {
  name: string
  projectName: string
  budget: number | null
  purpose: string | null
  timeline: string | null
  paymentPreference: string | null
  source?: string
  campaign?: string | null
}

export default function CallHelper({ name, projectName, budget, purpose, timeline, paymentPreference, source, campaign }: Props) {
  const project = projectName || 'hamare project'
  const isMeta = source === 'Meta' || source === 'Instagram'
  const items = [
    { label: 'Budget kitna hai?', done: !!budget },
    { label: 'Investment ke liye lena hai ya khud rehne ke liye?', done: !!purpose },
    { label: 'Kab tak lene ka plan hai?', done: !!timeline },
    { label: 'Payment cash me karenge ya home loan?', done: !!paymentPreference && paymentPreference !== 'Not decided' },
  ]
  const opening = isMeta
    ? 'Namaste ' + name + ' ji, aapne hamare ad par form bhara tha ' + project + ' ke liye. Kya abhi 2 minute baat kar sakte hain?'
    : 'Namaste ' + name + ' ji, main ' + project + ' ke baare me call kar raha hoon. Kya abhi 2 minute baat kar sakte hain?'
  return (
    <div className="rounded-xl border border-blue-500 p-3">
      <p className="text-xs font-semibold text-blue-600 uppercase">Before you call</p>
      {isMeta && (
        <p className="text-sm text-slate-800 mt-1">
          Ye lead Meta ad se aayi hai{campaign ? ' (' + campaign + ')' : ''}. Form me sirf naam aur phone mila hai, to naam ya number dobara mat poochna.
        </p>
      )}
      <p className="text-xs text-slate-500 mt-2">Shuruaat me bolo:</p>
      <p className="text-sm text-slate-800">&quot;{opening}&quot;</p>
      <p className="text-xs text-slate-500 mt-2">Ye poochna hai (jawab Edit Lead me save karo):</p>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i.label} className="text-sm text-slate-800">
            {i.done ? '✅ ' : '⬜ '}{i.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
