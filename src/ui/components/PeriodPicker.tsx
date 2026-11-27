import type { Period } from '../../core/periods'
import { haptic } from '../hooks'
import { IconChevL, IconChevR } from '../icons'

export function PeriodPicker({ period, periods, setPeriod }: { period: Period; periods: Period[]; setPeriod: (start: string) => void }) {
  const i = periods.findIndex(p => p.start === period.start)
  const go = (j: number) => { haptic(8); setPeriod(periods[j].start) }
  return (
    <span className="month" data-noswipe>
      <button disabled={i >= periods.length - 1} onClick={() => go(i + 1)} aria-label="Önceki dönem"><IconChevL size={18} /></button>
      <span key={period.start} className="anim">{period.label}</span>
      <button disabled={i <= 0} onClick={() => go(i - 1)} aria-label="Sonraki dönem"><IconChevR size={18} /></button>
    </span>
  )
}
