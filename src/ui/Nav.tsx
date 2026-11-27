import type { ComponentType } from 'react'
import { IconHome, IconList, IconRepeat, IconSettings } from './icons'

export type Tab = 'ozet' | 'hareketler' | 'abonelikler' | 'ayarlar'
export const TAB_ORDER: Tab[] = ['ozet', 'hareketler', 'abonelikler', 'ayarlar']

const TABS: { id: Tab; Icon: ComponentType<{ size?: number }>; label: string }[] = [
  { id: 'ozet', Icon: IconHome, label: 'Özet' },
  { id: 'hareketler', Icon: IconList, label: 'Hareketler' },
  { id: 'abonelikler', Icon: IconRepeat, label: 'Abonelik' },
  { id: 'ayarlar', Icon: IconSettings, label: 'Ayarlar' },
]

export function Nav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav" data-noswipe>
      {TABS.map(({ id, Icon, label }) => (
        <button key={id} className={id === tab ? 'on' : ''} onClick={() => onChange(id)} aria-label={label}>
          <Icon size={20} />
          {id === tab && <span className="lbl">{label}</span>}
        </button>
      ))}
    </nav>
  )
}
