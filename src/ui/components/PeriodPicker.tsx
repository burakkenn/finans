import type { Period } from '../../core/periods'

export function PeriodPicker({ period, periods, setPeriod }: { period: Period; periods: Period[]; setPeriod: (start: string) => void }) {
  const i = periods.findIndex(p => p.start === period.start)
  return (
    <span className="month">
      <button disabled={i >= periods.length - 1} onClick={() => setPeriod(periods[i + 1].start)} aria-label="Önceki dönem">‹</button>
      <span>{period.label}</span>
      <button disabled={i <= 0} onClick={() => setPeriod(periods[i - 1].start)} aria-label="Sonraki dönem">›</button>
    </span>
  )
}
