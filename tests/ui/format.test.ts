import { describe, expect, it } from 'vitest'
import { formatTL, monthLabel, shortDate } from '../../src/ui/format'

describe('format', () => {
  it('formats big amounts without decimals and with sign', () => {
    expect(formatTL(1770, true)).toBe('+1.770 ₺')
    expect(formatTL(23265.5)).toBe('23.266 ₺')
  })
  it('formats small amounts with decimals and a real minus sign', () => {
    expect(formatTL(-49.99)).toBe('−49,99 ₺')
    expect(formatTL(8.37)).toBe('8,37 ₺')
  })
  it('labels months and short dates in Turkish', () => {
    expect(monthLabel('2026-11')).toBe('Kasım 2026')
    expect(shortDate('2026-10-24')).toBe('24 Eki')
  })
})

import { displayTitle } from '../../src/ui/format'
import type { Txn } from '../../src/core/types'
const tx = (p: Partial<Txn>): Txn => ({ id: 'x', source: 'vadesiz', date: '2026-11-01', description: 'D', amount: -1, kind: 'gider', category: 'Diğer', needsReview: false, userEdited: false, ...p })

describe('displayTitle', () => {
  it('gives bank rows friendly names', () => {
    expect(displayTitle(tx({ kind: 'notr', category: 'Kart ödemesi' }))).toBe('Kart borcu ödemesi')
    expect(displayTitle(tx({ kind: 'notr', category: 'Kendi hesaplarım', amount: 4200 }))).toBe('Kendi hesabından gelen')
    expect(displayTitle(tx({ kind: 'notr', category: 'Kendi hesaplarım', amount: -4200 }))).toBe('Kendi hesabına giden')
    expect(displayTitle(tx({ kind: 'gelir', category: 'Faiz', amount: 37.78 }))).toBe('Faiz geliri')
    expect(displayTitle(tx({ kind: 'gelir', category: 'Faiz', amount: -6.61 }))).toBe('Faiz vergisi (stopaj)')
    expect(displayTitle(tx({ category: 'Banka ücreti', description: 'ÜCRET H1' }))).toBe('Transfer ücreti')
  })
  it('prefers the person name, then the description', () => {
    expect(displayTitle(tx({ counterparty: 'ALI VELI' }))).toBe('ALI VELI')
    expect(displayTitle(tx({ description: 'BOCADO RESTORAN' }))).toBe('BOCADO RESTORAN')
  })
})
