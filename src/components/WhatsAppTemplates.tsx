type Props = { name: string; phone: string; projectName: string }

export default function WhatsAppTemplates({ name, phone, projectName }: Props) {
  const project = projectName || 'our project'
  const templates = [
    { label: 'Introduction', text: 'Hello ' + name + ', thank you for your enquiry about ' + project + '. When is a good time to talk?' },
    { label: 'Missed call', text: 'Hello ' + name + ', I tried calling you but could not connect. Please tell me a good time to call.' },
    { label: 'Share details', text: 'Hello ' + name + ', sharing the details of ' + project + '. Please let me know if you have any questions.' },
    { label: 'Site visit invite', text: 'Hello ' + name + ', would you like to visit ' + project + ' this week? Please tell me a day and time that suits you.' },
    { label: 'Site visit confirm', text: 'Hello ' + name + ', confirming your site visit for ' + project + '. Please let me know if the time still works for you.' },
    { label: 'Follow-up', text: 'Hello ' + name + ', just following up on our last conversation about ' + project + '. Are you still interested?' },
  ]
  const number = '91' + phone.replace(/\D/g, '').slice(-10)
  return (
    <details className="bg-white rounded-2xl shadow p-4 mb-4">
      <summary className="font-semibold text-slate-800 cursor-pointer">WhatsApp Templates</summary>
      <div className="grid grid-cols-2 gap-2 mt-3">
        {templates.map((t) => (
          <a
            key={t.label}
            href={'https://wa.me/' + number + '?text=' + encodeURIComponent(t.text)}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl py-3 px-2 text-sm font-semibold text-center bg-green-600 text-white"
          >
            {t.label}
          </a>
        ))}
      </div>
    </details>
  )
}
