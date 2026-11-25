import { classify } from '../core/classify'
import { merchantKey } from '../core/subscriptions'
import { normTr } from '../core/text'
import type { Kind, RawTxn, Rule, Source, Txn } from '../core/types'
import { db, getSettings, saveSettings } from './db'

let persistAsked = false

export async function importFile(file: File): Promise<{ added: number; skipped: number; review: number; source: Source }> {
  const name = file.name.toLowerCase()
  const buf = await file.arrayBuffer()
  let raw: RawTxn[]
  let source: Source
  if (name.endsWith('.pdf')) {
    const { parseCardPdf } = await import('../core/parseCard')
    raw = await parseCardPdf(buf)
    source = 'kart'
  } else if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
    const { parseAccountXls } = await import('../core/parseAccount')
    const r = parseAccountXls(buf)
    raw = r.txns
    source = r.source
  } else {
    throw new Error('Bu dosya türü desteklenmiyor')
  }

  const [rules, settings] = await Promise.all([db.rules.toArray(), getSettings()])
  const existing = new Set((await db.txns.bulkGet(raw.map(t => t.id))).filter(Boolean).map(t => t!.id))
  const fresh: Txn[] = raw.filter(t => !existing.has(t.id))
    .map(t => ({ ...t, ...classify(t, rules, settings), userEdited: false }))
  await db.txns.bulkAdd(fresh)

  if (!persistAsked && typeof navigator !== 'undefined' && navigator.storage?.persist) {
    persistAsked = true
    navigator.storage.persist().catch(() => undefined)
  }
  return { added: fresh.length, skipped: raw.length - fresh.length, review: fresh.filter(t => t.needsReview).length, source }
}

export async function reclassifyAll(): Promise<void> {
  const [rules, settings] = await Promise.all([db.rules.toArray(), getSettings()])
  await db.transaction('rw', db.txns, async () => {
    const all = await db.txns.filter(t => !t.userEdited).toArray()
    await db.txns.bulkPut(all.map(t => ({ ...t, ...classify(t, rules, settings) })))
  })
}

export async function addRuleFromTxn(t: Txn, field: Rule['field'], kind: Kind, category: string): Promise<void> {
  const ruleField: Rule['field'] = field === 'counterparty' && t.counterparty ? 'counterparty' : 'description'
  let match = ruleField === 'counterparty' ? normTr(t.counterparty!) : merchantKey(t.description)
  if (match.length < 3) match = normTr(t.description)
  // A card refund marked as income must not become a rule: the key would also match the shop's purchases.
  const unsafe = t.source === 'kart' && kind !== 'gider'
  if (unsafe || match.length < 3) {
    await db.txns.update(t.id, { kind, category, userEdited: true, needsReview: false })
    return
  }
  await db.transaction('rw', db.rules, async () => {
    const same = await db.rules.filter(r => r.field === ruleField && normTr(r.match) === match).primaryKeys()
    await db.rules.bulkDelete(same)
    await db.rules.put({ id: crypto.randomUUID(), field: ruleField, match, kind, category })
  })
  await db.txns.update(t.id, { userEdited: false })
  await reclassifyAll()
}

export async function markNeutralPerson(counterparty: string): Promise<void> {
  const cp = normTr(counterparty)
  const s = await getSettings()
  if (!s.neutralPeople.includes(cp)) await saveSettings({ ...s, neutralPeople: [...s.neutralPeople, cp] })
  const theirRules = await db.rules.filter(r => r.field === 'counterparty' && normTr(r.match) === cp).primaryKeys()
  await db.rules.bulkDelete(theirRules)
  await db.txns.filter(t => !!t.counterparty && normTr(t.counterparty) === cp).modify({ userEdited: false })
  await reclassifyAll()
}
