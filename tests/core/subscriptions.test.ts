import { describe, expect, it } from 'vitest'
import { detectSubscriptionKeys, merchantKey, subscriptionView } from '../../src/core/subscriptions'
import type { Subscription, Txn } from '../../src/core/types'

let i = 0
const t = (date: string, description: string, amount: number, category = 'Diğer'): Txn => ({
  id: `t${i++}`, source: 'kart', date, description, amount, kind: 'gider', category, needsReview: false, userEdited: false,
})

const apple = [
  t('2026-10-24', 'APPLE.COM/BILL APPLE.COM/BIL IE', -169.99, 'Abonelik'),
  t('2026-10-24', 'APPLE.COM/BILL APPLE.COM/BIL IE', -99.99, 'Abonelik'),
  t('2026-10-30', 'APPLE.COM/BILL APPLE.COM/BIL IE', -49.99, 'Abonelik'),
  t('2026-11-08', 'APPLE.COM/BILL APPLE.COM/BIL IE', -65, 'Abonelik'),
  t('2026-11-12', 'APPLE.COM/BILL APPLE.COM/BIL IE', -84.99, 'Abonelik'),
  t('2026-11-13', 'APPLE.COM/BILL APPLE.COM/BIL IE', -499.99, 'Abonelik'),
]

describe('merchantKey', () => {
  it('uses the first token for web merchants', () => {
    expect(merchantKey('APPLE.COM/BILL APPLE.COM/BIL IE')).toBe('APPLE.COM/BILL')
    expect(merchantKey('İADE/IYZICO/TIKLAGELSIN.COM')).toBe('IYZICO/TIKLAGELSIN.COM')
  })
  it('cuts at the city', () => {
    expect(merchantKey('GOOGLE CLAUDE BY ANTH LONDON GB')).toBe('GOOGLE CLAUDE BY')
    expect(merchantKey('MİLENA TURNA CAFE İSTANBULTR')).toBe('MILENA TURNA CAFE')
    expect(merchantKey('VERSAY KUMAŞ BASKI GIDAİSTANBUL TR')).toBe('VERSAY KUMAŞ BASKI')
  })
})

describe('subscriptions', () => {
  it('groups all Apple payments under one key', () => {
    expect(detectSubscriptionKeys(apple)).toEqual(['APPLE.COM/BILL'])
  })
  it('detects a repeating same-amount card payment without a category', () => {
    const r = [t('2026-09-05', 'FOO MUSIC ISTANBUL TR', -59.99), t('2026-10-05', 'FOO MUSIC ISTANBUL TR', -59.99)]
    expect(detectSubscriptionKeys(r)).toEqual(['FOO MUSIC'])
  })
  it('does not guess subscriptions inside known everyday categories', () => {
    const r = [t('2026-10-19', 'VERSAY KUMAŞ BASKI GIDAİSTANBUL TR', -330, 'Market'), t('2026-11-03', 'VERSAY KUMAŞ BASKI GIDAİSTANBUL TR', -330, 'Market')]
    expect(detectSubscriptionKeys(r)).toEqual([])
  })
  it('does not treat a frequent cafe with varying amounts as a subscription', () => {
    const r = [t('2026-09-05', 'MİLENA CAFE İSTANBULTR', -240), t('2026-10-05', 'MİLENA CAFE İSTANBULTR', -440)]
    expect(detectSubscriptionKeys(r)).toEqual([])
  })
  it('lists each November Apple payment with date and amount', () => {
    const v = subscriptionView(apple, [], '2026-11')
    expect(v.length).toBe(1)
    expect(v[0].name).toBe('Apple')
    expect(v[0].payments.map(p => [p.date, p.amount])).toEqual([['2026-11-08', 65], ['2026-11-12', 84.99], ['2026-11-13', 499.99]])
    expect(v[0].monthTotal).toBeCloseTo(649.98, 2)
  })
  it('shows a saved label for a payment amount', () => {
    const subs: Subscription[] = [{ key: 'APPLE.COM/BILL', name: 'Apple', cancelled: false, paymentLabels: { '65.00': 'iCloud' } }]
    expect(subscriptionView(apple, subs, '2026-11')[0].payments[0].label).toBe('iCloud')
  })
  it('flags a charge after cancellation', () => {
    const subs: Subscription[] = [{ key: 'APPLE.COM/BILL', name: 'Apple', cancelled: true, cancelledAt: '2026-11-10', paymentLabels: {} }]
    expect(subscriptionView(apple, subs, '2026-11')[0].chargedAfterCancel).toBe(true)
  })
  it('hides excluded keys', () => {
    const subs: Subscription[] = [{ key: 'APPLE.COM/BILL', name: 'Apple', cancelled: false, excluded: true, paymentLabels: {} }]
    expect(subscriptionView(apple, subs, '2026-11')).toEqual([])
  })
})
