import { inPeriod, type Period } from './periods'
import type { Txn } from './types'

export interface PeriodSummary {
  gelir: number
  gider: number
  kalan: number
  byCategory: { category: string; amount: number }[]
  gelirByCategory: { category: string; amount: number }[]
  faiz: { brut: number; stopaj: number; net: number }
  kisiler: Txn[]
  reviewCount: number
}

const r2 = (n: number) => Math.round(n * 100) / 100

export function periodSummary(txns: Txn[], period: Pick<Period, 'start' | 'end'>): PeriodSummary {
  const inMonth = txns.filter(t => inPeriod(t.date, period))
  let gelir = 0, gider = 0, brut = 0, stopaj = 0
  const cats = new Map<string, number>()
  const inCats = new Map<string, number>()
  for (const t of inMonth) {
    if (t.kind === 'gelir') {
      gelir += t.amount
      inCats.set(t.category, (inCats.get(t.category) ?? 0) + t.amount)
      if (t.category === 'Faiz') { if (t.amount > 0) brut += t.amount; else stopaj += t.amount }
    } else if (t.kind === 'gider') {
      gider -= t.amount
      cats.set(t.category, (cats.get(t.category) ?? 0) - t.amount)
    }
  }
  const byCategory = [...cats].map(([category, amount]) => ({ category, amount: r2(amount) }))
    .filter(c => c.amount !== 0).sort((a, b) => b.amount - a.amount)
  return {
    gelir: r2(gelir),
    gider: r2(gider),
    kalan: r2(gelir - gider),
    byCategory,
    gelirByCategory: [...inCats].map(([category, amount]) => ({ category, amount: r2(amount) }))
      .filter(c => c.amount !== 0).sort((a, b) => b.amount - a.amount),
    faiz: { brut: r2(brut), stopaj: r2(stopaj), net: r2(brut + stopaj) },
    kisiler: inMonth.filter(t => t.kind === 'notr' && t.category === 'Kişiler'),
    reviewCount: txns.filter(t => t.needsReview).length,
  }
}
