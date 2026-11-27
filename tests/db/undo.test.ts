import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import { db, getSettings, saveSettings } from '../../src/db/db'
import { restoreSnapshot, takeSnapshot } from '../../src/db/undo'

beforeEach(async () => {
  await Promise.all([db.txns.clear(), db.rules.clear(), db.subs.clear(), db.settings.clear()])
})

it('restores transactions, rules and settings to the snapshot', async () => {
  await db.txns.put({ id: 'a', source: 'elle', date: '2026-11-01', description: 'x', amount: -5, kind: 'gider', category: 'Diğer', needsReview: true, userEdited: false })
  await saveSettings({ ownerName: 'A', neutralPeople: [] })
  const snap = await takeSnapshot()
  await db.txns.update('a', { category: 'Market', needsReview: false })
  await db.rules.put({ id: 'r', field: 'description', match: 'XYZ', kind: 'gider', category: 'Market' })
  await saveSettings({ ownerName: 'A', neutralPeople: ['B'] })
  await restoreSnapshot(snap)
  expect((await db.txns.get('a'))).toMatchObject({ category: 'Diğer', needsReview: true })
  expect(await db.rules.count()).toBe(0)
  expect((await getSettings()).neutralPeople).toEqual([])
})
