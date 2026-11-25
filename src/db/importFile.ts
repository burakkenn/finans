import { classify } from '../core/classify'
import { merchantKey } from '../core/subscriptions'
import { normTr } from '../core/text'
import type { Kind, RawTxn, Rule, Source, Txn } from '../core/types'
import { db, getSettings } from './db'

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
  const match = field === 'counterparty' && t.counterparty ? normTr(t.counterparty) : merchantKey(t.description)
  await db.rules.put({ id: crypto.randomUUID(), field: field === 'counterparty' && t.counterparty ? 'counterparty' : 'description', match, kind, category })
  await reclassifyAll()
}
