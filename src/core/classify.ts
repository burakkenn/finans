import { normTr } from './text'
import type { Kind, RawTxn, Rule, Settings, Txn } from './types'

type Result = Pick<Txn, 'kind' | 'category' | 'needsReview'>

export const BUILTIN_MERCHANTS: { match: string; category: string }[] = [
  ...['APPLE.COM/BILL', 'CLAUDE', 'SPOTIFY', 'NETFLIX', 'YOUTUBE', 'JOBSEEKER'].map(m => ({ match: m, category: 'Abonelik' })),
  ...['YEMEKSEPETI', 'TIKLAGELSIN', 'UBER EATS', 'MC DONALDS', 'MCDONALDS', 'DOMINOS', 'DOMİNOS', 'KAHVE DUNYASI', 'CAFE', 'CAFFE',
    'COFFEE', 'RESTORAN', 'RESTAURANT', 'BÖREK', 'BÜFE', 'PİZZA', 'SALAD', 'KAFE'].map(m => ({ match: m, category: 'Yemek & kafe' })),
  ...['ISTANBULKART', 'YANDEX', 'UBER'].map(m => ({ match: m, category: 'Ulaşım' })),
  ...['İTÜ', 'ITU'].map(m => ({ match: m, category: 'Okul' })),
  ...['ECZANE', 'WATSONS', 'GRATIS'].map(m => ({ match: m, category: 'Sağlık & bakım' })),
  ...['GIDA', 'MARKET', 'TEKEL', 'CARREFOUR', 'EKMEK', 'MAGAZASI'].map(m => ({ match: m, category: 'Market' })),
  ...['TRENDYOL', 'LCWAIKIKI', 'AVM', 'SHOP', 'DERİ'].map(m => ({ match: m, category: 'Alışveriş' })),
]

const r = (kind: Kind, category: string, needsReview = false): Result => ({ kind, category, needsReview })

export function classify(t: RawTxn, rules: Rule[], s: Settings): Result {
  const desc = normTr(t.description)
  const cp = t.counterparty ? normTr(t.counterparty) : ''
  const type = normTr(t.bankType ?? '')

  for (const rule of rules) {
    const value = rule.field === 'counterparty' ? cp : desc
    if (value && value.includes(normTr(rule.match))) return r(rule.kind, rule.category)
  }

  if (t.source === 'vadeli' && (type.includes('FAIZ VERME') || type.includes('VERGI ALMA'))) return r('gelir', 'Faiz')
  if (desc.includes('KRE.KART BORÇ ÖDEME') || (t.source === 'kart' && desc.includes('HESAPTAN AKTARIM'))) return r('notr', 'Kart ödemesi')
  const owner = normTr(s.ownerName)
  if (desc.includes('HESAPLAR ARASI AKTARIM') || desc.includes('HESAP AÇMA') || type.includes('DÖVIZ') || (owner && cp === owner)) {
    return r('notr', 'Kendi hesaplarım')
  }
  if (/\bATM\b/.test(desc) && t.amount < 0) return r('notr', 'Nakit')
  if (desc.startsWith('ÜCRET')) return r('gider', 'Banka ücreti')
  if (cp && s.neutralPeople.map(normTr).includes(cp)) return r('notr', 'Kişiler')
  if (cp) return r('gider', 'Arkadaşlarla ödeşme', true)

  if (t.source === 'kart') {
    const key = desc.replace(/^IADE\//, '')
    const hit = BUILTIN_MERCHANTS.find(m => key.includes(normTr(m.match)))
    return hit ? r('gider', hit.category) : r('gider', 'Diğer', true)
  }
  return t.amount > 0 ? r('gelir', 'Diğer gelir', true) : r('gider', 'Diğer', true)
}
