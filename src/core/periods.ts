import type { Txn } from './types'

export interface Period {
  /** YYYY-MM-DD, inclusive */
  start: string
  /** YYYY-MM-DD, inclusive; undefined = still running */
  end?: string
  /** "Ekim–Kasım" */
  label: string
}

export const MAIN_ALLOWANCE_MIN = 15000
const CLUSTER_DAYS = 20
const PIVOT_DAY = 17
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

const toDate = (d: string) => new Date(`${d}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: string, n: number) => { const x = toDate(d); x.setUTCDate(x.getUTCDate() + n); return iso(x) }
const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000)
const pivotOnOrBefore = (d: string) => {
  const x = toDate(d)
  if (x.getUTCDate() < PIVOT_DAY) x.setUTCMonth(x.getUTCMonth() - 1)
  x.setUTCDate(PIVOT_DAY)
  return iso(x)
}
const nextPivot = (d: string) => { const x = toDate(d); x.setUTCMonth(x.getUTCMonth() + 1); return iso(x) }

function labelFor(start: string, end?: string): string {
  const s = toDate(start)
  const e = end ? toDate(end) : (() => { const x = toDate(start); x.setUTCMonth(x.getUTCMonth() + 1); return x })()
  const a = MONTHS[s.getUTCMonth()], b = MONTHS[e.getUTCMonth()]
  return a === b ? a : `${a}–${b}`
}

function isMainAllowance(t: Txn): boolean {
  return t.kind === 'gelir' && t.category === 'Harçlık' && t.amount >= MAIN_ALLOWANCE_MIN
}

/** Transactions that start a period: forced ones, plus one main allowance per ~month (closest to the 17th). */
export function periodAnchors(txns: Txn[]): Txn[] {
  const forced = txns.filter(t => t.periodStart === true)
  const auto = txns.filter(t => t.periodStart !== false && t.periodStart !== true && isMainAllowance(t))
    .sort((a, b) => a.date.localeCompare(b.date))
  const chosen: Txn[] = []
  let cluster: Txn[] = []
  const flush = () => {
    if (!cluster.length) return
    const best = [...cluster].sort((a, b) =>
      Math.abs(toDate(a.date).getUTCDate() - PIVOT_DAY) - Math.abs(toDate(b.date).getUTCDate() - PIVOT_DAY) || b.amount - a.amount)[0]
    chosen.push(best)
    cluster = []
  }
  for (const t of auto) {
    if (cluster.length && daysBetween(cluster[0].date, t.date) >= CLUSTER_DAYS) flush()
    cluster.push(t)
  }
  flush()
  const byDate = new Map<string, Txn>()
  for (const t of [...chosen, ...forced]) byDate.set(t.date, t)
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function periodAnchorIds(txns: Txn[]): Set<string> {
  return new Set(periodAnchors(txns).map(t => t.id))
}

/** Newest first. `today` (YYYY-MM-DD) extends the synthetic periods when there is no main allowance. */
export function computePeriods(txns: Txn[], today: string): Period[] {
  if (!txns.length) return []
  const anchorDates = periodAnchors(txns).map(t => t.date)
  const earliest = txns.reduce((m, t) => (t.date < m ? t.date : m), txns[0].date)
  const starts: string[] = []

  const syntheticUntil = anchorDates[0] ?? addDays(today > earliest ? today : earliest, 1)
  for (let p = pivotOnOrBefore(earliest); p < syntheticUntil; p = nextPivot(p)) starts.push(p)
  for (const d of anchorDates) if (!starts.includes(d)) starts.push(d)
  starts.sort()

  const periods: Period[] = starts.map((start, i) => {
    const end = starts[i + 1] ? addDays(starts[i + 1], -1) : undefined
    return { start, end, label: labelFor(start, end) }
  })
  return periods.reverse()
}

export function inPeriod(date: string, p: Pick<Period, 'start' | 'end'>): boolean {
  return date >= p.start && (!p.end || date <= p.end)
}
