import { db } from '../db/db'

export async function exportBackup(): Promise<Blob> {
  const [txns, rules, subs, settings] = await Promise.all([db.txns.toArray(), db.rules.toArray(), db.subs.toArray(), db.settings.toArray()])
  const data = { version: 1, exportedAt: new Date().toISOString(), txns, rules, subs, settings }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

export async function importBackup(file: File): Promise<void> {
  const data = JSON.parse(await file.text())
  if (data?.version !== 1 || !Array.isArray(data.txns)) throw new Error('Bu dosya geçerli bir Finans yedeği değil')
  await db.transaction('rw', [db.txns, db.rules, db.subs, db.settings], async () => {
    await Promise.all([db.txns.clear(), db.rules.clear(), db.subs.clear(), db.settings.clear()])
    await db.txns.bulkPut(data.txns)
    await db.rules.bulkPut(data.rules ?? [])
    await db.subs.bulkPut(data.subs ?? [])
    await db.settings.bulkPut(data.settings ?? [])
  })
}
