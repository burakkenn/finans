import { describe, expect, it } from 'vitest'
import { classify } from '../../src/core/classify'
import type { RawTxn, Rule, Settings } from '../../src/core/types'

const s: Settings = { ownerName: 'Deniz Kaya', neutralPeople: ['CAN TEST'] }
const acc = (p: Partial<RawTxn>): RawTxn => ({ id: 'x', source: 'vadesiz', date: '2026-11-01', description: '', amount: -1, ...p })
const card = (description: string, amount: number): RawTxn => ({ id: 'c', source: 'kart', date: '2026-11-01', description, amount })
const c = (t: RawTxn, rules: Rule[] = []) => classify(t, rules, s)

describe('classify', () => {
  it('user rule wins over defaults', () => {
    const rule: Rule = { id: 'r', field: 'counterparty', match: 'ALİ VELİ', kind: 'gelir', category: 'Harçlık' }
    expect(c(acc({ amount: 3000, bankType: 'Havale', counterparty: 'ALI VELI' }), [rule])).toEqual({ kind: 'gelir', category: 'Harçlık', needsReview: false })
  })
  it('gross interest and tax both go to Faiz income', () => {
    expect(c(acc({ source: 'vadeli', amount: 37.78, bankType: 'Vadeli - Faiz Verme' }))).toMatchObject({ kind: 'gelir', category: 'Faiz' })
    expect(c(acc({ source: 'vadeli', amount: -6.61, bankType: 'Vadeli - Vergi Alma' }))).toMatchObject({ kind: 'gelir', category: 'Faiz' })
  })
  it('card payment is neutral on both the account and the card', () => {
    expect(c(acc({ amount: -1500.25, bankType: 'Para Çekme', description: '0143/1-MUHASEBE HESABINA İSCEP KRE.KART BORÇ ÖDEME' }))).toMatchObject({ kind: 'notr', category: 'Kart ödemesi' })
    expect(c(card('1000-111111 HESAPTAN AKTARIM 1000 İNTERAKTİF', 750))).toMatchObject({ kind: 'notr', category: 'Kart ödemesi' })
  })
  it('own transfers are neutral', () => {
    expect(c(acc({ amount: 4200, bankType: 'Para Transferi', description: '1000/2222222 HESAPTAN DENIZ KAYA Hesaplar Arası Aktarım' }))).toMatchObject({ kind: 'notr', category: 'Kendi hesaplarım' })
    expect(c(acc({ amount: -2100, bankType: 'FAST', counterparty: 'DENIZ KAYA', description: 'Deniz Kaya*TR69*DENIZ KAYA tarafından aktarılan' }))).toMatchObject({ kind: 'notr' })
    expect(c(acc({ amount: 250.5, bankType: 'Döviz', description: '1000-1.İŞCEP. DÖVİZ SATIŞ / 51,90' }))).toMatchObject({ kind: 'notr' })
    expect(c(acc({ source: 'vadeli', amount: 12000, bankType: 'Hesap Açma', description: 'HESAP AÇMA İŞLEMİ 1000:1 -> 1000:2' }))).toMatchObject({ kind: 'notr' })
  })
  it('ATM withdrawal moves money to cash, not expense', () => {
    expect(c(acc({ amount: -500, bankType: 'Para Çekme', description: 'ATM PARA ÇEKME KADIKOY' }))).toMatchObject({ kind: 'notr', category: 'Nakit' })
  })
  it('transfer fee is a bank fee expense', () => {
    expect(c(acc({ amount: -8.37, bankType: 'FAST', counterparty: 'ÜCRET H1 490,00 TRY ÜZ.', description: 'ÜCRET H1 490,00 TRY ÜZ.' }))).toMatchObject({ kind: 'gider', category: 'Banka ücreti', needsReview: false })
  })
  it('neutral person transfers are not counted', () => {
    expect(c(acc({ amount: -500, bankType: 'FAST', counterparty: 'CAN TEST' }))).toMatchObject({ kind: 'notr', category: 'Kişiler' })
  })
  it('money sent to a person defaults to friend settle-up and asks the user', () => {
    expect(c(acc({ amount: -400, bankType: 'FAST', counterparty: 'MEHMET X' }))).toEqual({ kind: 'gider', category: 'Arkadaşlarla ödeşme', needsReview: true })
  })
  it('unconfirmed money from a person counts as income until the user says it was a repayment', () => {
    expect(c(acc({ amount: 15000, bankType: 'Havale', counterparty: 'MEHMET X' }))).toEqual({ kind: 'gelir', category: 'Diğer gelir', needsReview: true })
  })
  it('card refund counts against the merchant category', () => {
    expect(c(card('İADE/IYZICO/TIKLAGELSIN.COM', 549))).toEqual({ kind: 'gider', category: 'Yemek & kafe', needsReview: false })
  })
  it('known card merchants get categories', () => {
    expect(c(card('APPLE.COM/BILL APPLE.COM/BIL IE', -99.99)).category).toBe('Abonelik')
    expect(c(card('GOOGLE CLAUDE BY ANTH LONDON GB', -995.04)).category).toBe('Abonelik')
    expect(c(card('UBER EATS YEMEK ISTANBULTR', -425)).category).toBe('Yemek & kafe')
    expect(c(card('IYZICO/ISTANBULKART.IST ISTANBULTR', -653)).category).toBe('Ulaşım')
    expect(c(card('İTÜ STRATEJİ GELİŞTİRMEİSTANBUL TR', -200)).category).toBe('Okul')
    expect(c(card('GRATIS NAUTILUS AVM ISTANBULTR', -225)).category).toBe('Sağlık & bakım')
  })
  it('unknown card merchant goes to review', () => {
    expect(c(card('HASAN ÖZTÜRKMEN İSTANBUL TR', -370))).toEqual({ kind: 'gider', category: 'Diğer', needsReview: true })
  })
  it('unknown incoming account money is income to review', () => {
    expect(c(acc({ amount: 5274, bankType: 'FAST', description: 'X ÖDEME KURULUŞU*0015*Transfer' , counterparty: undefined }))).toEqual({ kind: 'gelir', category: 'Diğer gelir', needsReview: true })
  })
})

describe('classify rule safety (review C1)', () => {
  it('ignores a rule with an empty match', () => {
    const bad: Rule = { id: 'r', field: 'description', match: '', kind: 'gelir', category: 'Diğer gelir' }
    expect(c(acc({ amount: -1500.25, bankType: 'Para Çekme', description: 'X KRE.KART BORÇ ÖDEME' }), [bad])).toMatchObject({ kind: 'notr', category: 'Kart ödemesi' })
  })
})
