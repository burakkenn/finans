export type Tab = 'ozet' | 'hareketler' | 'abonelikler' | 'ayarlar'

const TABS: { id: Tab; ico: string; label: string }[] = [
  { id: 'ozet', ico: '◔', label: 'Özet' },
  { id: 'hareketler', ico: '☰', label: 'Hareketler' },
  { id: 'abonelikler', ico: '↻', label: 'Abonelikler' },
  { id: 'ayarlar', ico: '⚙', label: 'Ayarlar' },
]

export function Nav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav">
      {TABS.map(t => (
        <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => onChange(t.id)} aria-label={t.label}>
          <span className="ico">{t.ico}</span>
          {t.id === tab && <span>{t.label}</span>}
        </button>
      ))}
    </nav>
  )
}
