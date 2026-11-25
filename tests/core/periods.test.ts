import { describe, expect, it } from 'vitest'
import { computePeriods, inPeriod, periodAnchorIds } from '../../src/core/periods'
import type { Txn } from '../../src/core/types'

let i = 0
const t = (date: string, amount: number, category = 'Harçlık', extra: Partial<Txn> = {}): Txn => ({
  id: `t${i++}`, source: 'vadesiz', date, description: 'x', amount, kind: amount > 0 ? 'gelir' : 'gider', category,
  needsReview: false, userEdited: false, ...extra,
})

const data = [
  t('2026-05-25', 4600),
  t('2026-09-26', 3000),
  t('2026-10-12', 30000),
  t('2026-10-17', 20000),
  t('2026-11-11', 3000),
  t('2026-11-20', 21000),
  t('2026-11-24', -500, 'Market'),
]

describe('periods', () => {
  const ps = computePeriods(data, '2026-11-25')

  it('starts a period at each main allowance (>= 15.000 Harçlık) and keeps it open until the next', () => {
    expect(ps[0]).toMatchObject({ start: '2026-11-20', end: undefined, label: 'Kasım–Aralık' })
    expect(ps[1]).toMatchObject({ start: '2026-10-17', end: '2026-11-19', label: 'Ekim–Kasım' })
  })
  it('treats a big payment a few days before the main one as a top-up (closest to the 17th wins)', () => {
    expect(ps.some(p => p.start === '2026-10-12')).toBe(false)
  })
  it('uses the 17th of each month before the first main allowance', () => {
    expect(ps[2]).toMatchObject({ start: '2026-09-17', end: '2026-10-16', label: 'Eylül–Ekim' })
    expect(ps[ps.length - 1]).toMatchObject({ start: '2026-05-17', end: '2026-06-16' })
  })
  it('small top-ups do not start a period', () => {
    expect(ps.some(p => p.start === '2026-11-11')).toBe(false)
  })
  it('a manual flag overrides the automatic choice', () => {
    const forced = computePeriods([...data, t('2026-11-05', 2000, 'Harçlık', { periodStart: true })], '2026-11-25')
    expect(forced.some(p => p.start === '2026-11-05')).toBe(true)
    const blocked = computePeriods(data.map(x => (x.date === '2026-11-20' ? { ...x, periodStart: false } : x)), '2026-11-25')
    expect(blocked[0].start).toBe('2026-10-17')
  })
  it('falls back to 17th-to-17th periods when there is no main allowance at all', () => {
    const p = computePeriods([t('2026-11-24', -50, 'Market')], '2026-11-25')
    expect(p).toEqual([expect.objectContaining({ start: '2026-11-17', end: undefined, label: 'Kasım–Aralık' })])
  })
  it('exposes which transactions are period anchors', () => {
    expect(periodAnchorIds(data).size).toBe(2)
  })
  it('checks dates against open and closed periods', () => {
    expect(inPeriod('2026-11-19', ps[1])).toBe(true)
    expect(inPeriod('2026-11-20', ps[1])).toBe(false)
    expect(inPeriod('2027-01-03', ps[0])).toBe(true)
  })
})
