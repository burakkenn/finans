import { describe, expect, it } from 'vitest'
import { fixMojibake, normTr, parseTrAmount, parseTrDate } from '../../src/core/text'

describe('text helpers', () => {
  it('fixes UTF-8 mojibake from PDF text', () => {
    expect(fixMojibake('Ä°ADE/IYZICO')).toBe('İADE/IYZICO')
  })
  it('normalizes case and whitespace', () => {
    expect(normTr(' apple.com/bill  apple ')).toBe('APPLE.COM/BILL APPLE')
  })
  it('folds dotted and dotless capital I so bank spellings match', () => {
    expect(normTr('iade')).toBe('IADE')
    expect(normTr('İADE')).toBe(normTr('IADE'))
    expect(normTr('ışık çöğüş')).toBe('IŞIK ÇÖĞÜŞ')
  })
  it('parses Turkish amounts', () => {
    expect(parseTrAmount('-12.345,67')).toBe(-12345.67)
    expect(parseTrAmount('9.876,50 TL')).toBe(9876.5)
  })
  it('parses date with time', () => {
    expect(parseTrDate('25/11/2026-14:05:55')).toEqual({ date: '2026-11-25', time: '14:05' })
  })
  it('parses date only', () => {
    expect(parseTrDate('18/10/2026')).toEqual({ date: '2026-10-18' })
  })
})
