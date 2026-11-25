import { normTr } from './text'
import type { Subscription, Txn } from './types'

const CITY_RE = /(ISTANBUL|ANKARA|IZMIR|LONDON|AMSTERDAM|DUBLIN|LUXEMBOURG)/

export function merchantKey(description: string): string {
  const tokens = normTr(description).replace(/^IADE\//, '').split(' ')
  if (/[/]|\.COM/.test(tokens[0])) return tokens[0]
  const out: string[] = []
  for (const tok of tokens) {
    const m = tok.match(CITY_RE)
    const isCity = m && /^(TR|TU|GB|NL|IE)?$/.test(tok.slice(m.index! + m[0].length))
    if (m && isCity && out.length > 0) {
      const before = tok.slice(0, m.index)
      if (before) out.push(before)
      break
    }
    out.push(tok)
    if (out.length === 3) break
  }
  return out.slice(0, 3).join(' ')
}

const KNOWN_NAMES: [RegExp, string][] = [
  [/APPLE/, 'Apple'], [/CLAUDE/, 'Claude'], [/JOBSEEKER/, 'Jobseeker'], [/SPOTIFY/, 'Spotify'],
  [/NETFLIX/, 'Netflix'], [/YOUTUBE/, 'YouTube'], [/GOOGLE/, 'Google'],
]

export function defaultSubName(key: string): string {
  const hit = KNOWN_NAMES.find(([re]) => re.test(key))
  if (hit) return hit[1]
  return key.toLocaleLowerCase('tr-TR').replace(/(^|\s)\S/g, s => s.toLocaleUpperCase('tr-TR'))
}

const month = (d: string) => d.slice(0, 7)

export function detectSubscriptionKeys(txns: Txn[]): string[] {
  const keys = new Set<string>()
  const byKey = new Map<string, Txn[]>()
  for (const t of txns) {
    if (t.kind !== 'gider' || t.amount >= 0) continue
    const k = merchantKey(t.description)
    if (t.category === 'Abonelik') keys.add(k)
    if (t.source !== 'kart' || (t.category !== 'Diğer' && t.category !== 'Abonelik')) continue
    byKey.set(k, [...(byKey.get(k) ?? []), t])
  }
  for (const [k, list] of byKey) {
    if (keys.has(k)) continue
    const months = new Set(list.map(t => month(t.date)))
    const amounts = list.map(t => -t.amount)
    if (months.size >= 2 && Math.min(...amounts) / Math.max(...amounts) >= 0.9) keys.add(k)
  }
  return [...keys]
}

export interface SubscriptionRow {
  key: string
  name: string
  cancelled: boolean
  monthTotal: number
  payments: { id: string; date: string; amount: number; label?: string }[]
  chargedAfterCancel: boolean
}

export function subscriptionView(txns: Txn[], subs: Subscription[], m: string): SubscriptionRow[] {
  const saved = new Map(subs.map(s => [s.key, s]))
  const keys = new Set([...detectSubscriptionKeys(txns), ...subs.filter(s => !s.excluded).map(s => s.key)])
  const rows: SubscriptionRow[] = []
  for (const key of keys) {
    const sub = saved.get(key)
    if (sub?.excluded) continue
    const all = txns.filter(t => t.kind === 'gider' && t.amount < 0 && merchantKey(t.description) === key)
    const payments = all.filter(t => month(t.date) === m).sort((a, b) => a.date.localeCompare(b.date))
      .map(t => ({ id: t.id, date: t.date, amount: -t.amount, label: sub?.paymentLabels[(-t.amount).toFixed(2)] }))
    rows.push({
      key,
      name: sub?.name || defaultSubName(key),
      cancelled: !!sub?.cancelled,
      monthTotal: payments.reduce((s, p) => s + p.amount, 0),
      payments,
      chargedAfterCancel: !!(sub?.cancelled && sub.cancelledAt && all.some(t => t.date > sub.cancelledAt!)),
    })
  }
  return rows.sort((a, b) => b.monthTotal - a.monthTotal)
}
