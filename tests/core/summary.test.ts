import { describe, expect, it } from 'vitest'
import { periodSummary } from '../../src/core/summary'
import type { Kind, Txn } from '../../src/core/types'

let i = 0
const t = (date: string, amount: number, kind: Kind, category: string, needsReview = false): Txn => ({
  id: `t${i++}`, source: 'vadesiz', date, description: category, amount, kind, category, needsReview, userEdited: false,
})

const txns = [
  t('2026-11-11', 3000, 'gelir', 'Harçlık'),
  t('2026-11-12', 37.78, 'gelir', 'Faiz'),
  t('2026-11-12', -6.61, 'gelir', 'Faiz'),
  t('2026-11-03', -600, 'gider', 'Arkadaşlarla ödeşme'),
  t('2026-11-04', 400, 'gider', 'Arkadaşlarla ödeşme'),
  t('2026-11-05', -1000, 'gider', 'Yemek & kafe'),
  t('2026-11-06', -1500.25, 'notr', 'Kart ödemesi'),
  t('2026-11-07', -500, 'notr', 'Kişiler'),
  t('2026-10-30', -99, 'gider', 'Diğer', true),
]

describe('monthSummary', () => {
  const s = periodSummary(txns, { start: '2026-11-01', end: '2026-11-30' })
  it('sums income including net interest', () => {
    expect(s.gelir).toBeCloseTo(3031.17, 2)
  })
  it('nets friend repayments and ignores neutral rows', () => {
    expect(s.gider).toBeCloseTo(1200, 2)
    expect(s.byCategory).toEqual([{ category: 'Yemek & kafe', amount: 1000 }, { category: 'Arkadaşlarla ödeşme', amount: 200 }])
  })
  it('computes what is left', () => {
    expect(s.kalan).toBeCloseTo(1831.17, 2)
  })
  it('splits interest into gross, tax and net', () => {
    expect(s.faiz.brut).toBeCloseTo(37.78, 2)
    expect(s.faiz.stopaj).toBeCloseTo(-6.61, 2)
    expect(s.faiz.net).toBeCloseTo(31.17, 2)
  })
  it('lists neutral person transfers and counts review items across all months', () => {
    expect(s.kisiler.map(x => x.amount)).toEqual([-500])
    expect(s.reviewCount).toBe(1)
  })
  it('respects an open-ended period', () => {
    expect(periodSummary(txns, { start: '2026-11-07' }).gelir).toBeCloseTo(3031.17, 2)
    expect(periodSummary(txns, { start: '2026-11-07' }).gider).toBe(0)
  })
})
