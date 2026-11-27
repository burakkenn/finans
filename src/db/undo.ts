import { db } from './db'

export type Snapshot = Awaited<ReturnType<typeof takeSnapshot>>

export async function takeSnapshot() {
  const [txns, rules, settings] = await Promise.all([db.txns.toArray(), db.rules.toArray(), db.settings.toArray()])
  return { txns, rules, settings }
}

export async function restoreSnapshot(s: Snapshot): Promise<void> {
  await db.transaction('rw', [db.txns, db.rules, db.settings], async () => {
    await Promise.all([db.txns.clear(), db.rules.clear(), db.settings.clear()])
    await db.txns.bulkPut(s.txns)
    await db.rules.bulkPut(s.rules)
    await db.settings.bulkPut(s.settings)
  })
}
