import { inPeriod, type Period } from './periods'
import { periodSummary } from './summary'
import { normTr } from './text'
import type { Txn } from './types'

const toDate = (d: string) => new Date(`${d}T00:00:00Z`)
const dayDiff = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000)

export interface PeriodInsights {
  /** days counted (elapsed so far for an open period) */
  days: number
  dailyAvg: number
  prevDailyAvg?: number
  /** % change of daily average vs previous period (negative = spent less) */
  changePct?: number
  /** open period only: days until the next allowance is expected (~1 month after start) */
  daysLeft?: number
}

function lengthOf(p: Pick<Period, 'start' | 'end'>, today: string): number {
  const last = p.end ?? (today < p.start ? p.start : today)
  return Math.max(1, dayDiff(p.start, last) + 1)
}

export function periodInsights(txns: Txn[], period: Period, periods: Period[], today: string): PeriodInsights {
  const days = lengthOf(period, today)
  const dailyAvg = periodSummary(txns, period).gider / days
  const idx = periods.findIndex(p => p.start === period.start)
  const prev = idx >= 0 ? periods[idx + 1] : undefined
  const out: PeriodInsights = { days, dailyAvg }
  if (!period.end) {
    const next = toDate(period.start)
    next.setUTCMonth(next.getUTCMonth() + 1)
    out.daysLeft = Math.max(0, dayDiff(today, next.toISOString().slice(0, 10)))
    if (prev) {
      out.prevDailyAvg = periodSummary(txns, prev).gider / lengthOf(prev, today)
      if (out.prevDailyAvg > 0) out.changePct = Math.round((dailyAvg / out.prevDailyAvg - 1) * 100)
    }
  }
  return out
}

export type KindFilter = 'hepsi' | 'gider' | 'gelir' | 'notr' | 'sor'
export interface TxnFilter { period?: Pick<Period, 'start' | 'end'>; category?: string; query: string; kind: KindFilter }

export function filterTxns(txns: Txn[], f: TxnFilter): { items: Txn[]; total: number } {
  const nq = normTr(f.query)
  const items = txns
    .filter(t => (nq || !f.period ? true : inPeriod(t.date, f.period)))
    .filter(t => !f.category || t.category === f.category)
    .filter(t => !nq || normTr(`${t.description} ${t.counterparty ?? ''} ${t.category} ${t.note ?? ''}`).includes(nq))
    .filter(t => f.kind === 'hepsi' || (f.kind === 'sor' ? t.needsReview : t.kind === f.kind))
    .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))
  const total = Math.round(items.filter(t => t.kind !== 'notr').reduce((s, t) => s + t.amount, 0) * 100) / 100
  return { items, total }
}
