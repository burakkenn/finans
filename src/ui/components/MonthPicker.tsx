import { monthLabel } from '../format'

export function MonthPicker({ month, months, setMonth }: { month: string; months: string[]; setMonth: (m: string) => void }) {
  const i = months.indexOf(month)
  return (
    <span className="month">
      <button disabled={i >= months.length - 1} onClick={() => setMonth(months[i + 1])} aria-label="Önceki ay">‹</button>
      <span>{monthLabel(month)}</span>
      <button disabled={i <= 0} onClick={() => setMonth(months[i - 1])} aria-label="Sonraki ay">›</button>
    </span>
  )
}
