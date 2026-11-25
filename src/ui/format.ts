import type { Txn } from '../core/types'

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
const SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

export function formatTL(n: number, sign = false): string {
  const abs = Math.abs(n)
  const digits = abs >= 1000 ? 0 : 2
  const body = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(abs)
  const prefix = n < 0 ? '−' : sign && n > 0 ? '+' : ''
  return `${prefix}${body} ₺`
}

export function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return `${MONTHS[mo - 1]} ${y}`
}

export function shortDate(d: string): string {
  const [, mo, day] = d.split('-').map(Number)
  return `${day} ${SHORT[mo - 1]}`
}

export function dayLabel(d: string): string {
  const [y, mo, day] = d.split('-').map(Number)
  const wd = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'][new Date(y, mo - 1, day).getDay()]
  return `${day} ${MONTHS[mo - 1]} · ${wd}`
}

export const CATEGORY_EMOJI: Record<string, string> = {
  'Yemek & kafe': '🍔', Market: '🛒', Abonelik: '🔁', Ulaşım: '🚇', Okul: '🎓', 'Sağlık & bakım': '💊',
  Alışveriş: '🛍️', 'Arkadaşlarla ödeşme': '🤝', 'Banka ücreti': '🏦', Diğer: '📦', Harçlık: '💸', Faiz: '💰',
  'Diğer gelir': '➕', 'Kart ödemesi': '💳', 'Kendi hesaplarım': '🔄', Nakit: '💵', Kişiler: '👥',
}

export const emojiFor = (c: string) => CATEGORY_EMOJI[c] ?? '🏷️'

export const BASE_CATEGORIES = {
  gider: ['Yemek & kafe', 'Market', 'Abonelik', 'Ulaşım', 'Okul', 'Sağlık & bakım', 'Alışveriş', 'Arkadaşlarla ödeşme', 'Banka ücreti', 'Diğer'],
  gelir: ['Harçlık', 'Faiz', 'Diğer gelir'],
}

export function displayTitle(t: Txn): string {
  if (t.kind === 'notr' && t.category === 'Kart ödemesi') return 'Kart borcu ödemesi'
  if (t.kind === 'notr' && t.category === 'Kendi hesaplarım' && !t.counterparty) return t.amount > 0 ? 'Kendi hesabından gelen' : 'Kendi hesabına giden'
  if (t.category === 'Faiz' && !t.counterparty) return t.amount > 0 ? 'Faiz geliri' : 'Faiz vergisi (stopaj)'
  if (t.category === 'Banka ücreti' && /^ÜCRET/i.test(t.description)) return 'Transfer ücreti'
  return t.counterparty ?? t.description
}

export function parseAmountInput(s: string): number {
  const v = s.trim().replace(/\s|₺/g, '')
  if (v.includes(',')) return Number(v.replace(/\./g, '').replace(',', '.'))
  if (/^\d+\.\d{1,2}$/.test(v)) return Number(v)
  return Number(v.replace(/\./g, ''))
}
