import { describe, expect, it } from 'vitest'
import { filterTxns, periodInsights } from '../../src/core/insights'
import type { Txn } from '../../src/core/types'

let i = 0
const t = (date: string, amount: number, category: string, kind: Txn['kind'] = 'gider', extra: Partial<Txn> = {}): Txn => ({
  id: `t${i++}`, source: 'kart', date, description: `${category} yer`, amount, kind, category, needsReview: false, userEdited: false, ...extra,
})

const prev = { start: '2026-10-17', end: '2026-11-19', label: 'Ekim–Kasım' }
const cur = { start: '2026-11-20', label: 'Kasım–Aralık' }
const txns = [
  t('2026-10-20', -3300, 'Market'), // prev: 3300 over 34 days ≈ 97.06/day
  t('2026-11-21', -300, 'Yemek & kafe'),
  t('2026-11-22', -100, 'Market'),
]

describe('periodInsights', () => {
  it('daily average uses days elapsed for an open period', () => {
    const r = periodInsights(txns, cur, [cur, prev], '2026-11-24') // 5 days elapsed
    expect(r.days).toBe(5)
    expect(r.dailyAvg).toBeCloseTo(80, 2)
  })
  it('compares with the previous period daily average', () => {
    const r = periodInsights(txns, cur, [cur, prev], '2026-11-24')
    expect(r.prevDailyAvg).toBeCloseTo(3300 / 34, 2)
    expect(r.changePct).toBe(Math.round((80 / (3300 / 34) - 1) * 100))
  })
  it('estimates days until the next allowance for an open period', () => {
    expect(periodInsights(txns, cur, [cur, prev], '2026-11-24').daysLeft).toBe(26) // 2026-12-20
  })
  it('closed period uses its full length and has no days left', () => {
    const r = periodInsights(txns, prev, [cur, prev], '2026-11-24')
    expect(r.days).toBe(34)
    expect(r.daysLeft).toBeUndefined()
    expect(r.prevDailyAvg).toBeUndefined()
  })
})

describe('filterTxns', () => {
  it('filters by period, category and text, and totals the result', () => {
    const r = filterTxns(txns, { period: cur, category: 'Market', query: '', kind: 'hepsi' })
    expect(r.items.map(x => x.amount)).toEqual([-100])
    expect(r.total).toBe(-100)
  })
  it('a search looks across all periods', () => {
    expect(filterTxns(txns, { period: cur, query: 'market', kind: 'hepsi' }).items.length).toBe(2)
  })
  it('filters by kind and review state', () => {
    const r = filterTxns([...txns, t('2026-11-23', 50, 'Diğer gelir', 'gelir', { needsReview: true })], { period: cur, query: '', kind: 'sor' })
    expect(r.items.length).toBe(1)
  })
})
