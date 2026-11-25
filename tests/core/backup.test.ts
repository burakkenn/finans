import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup } from '../../src/core/backup'
import { db, getSettings, saveSettings } from '../../src/db/db'

beforeEach(async () => {
  await Promise.all([db.txns.clear(), db.rules.clear(), db.subs.clear(), db.settings.clear()])
})

describe('backup', () => {
  it('round-trips all tables', async () => {
    await db.txns.put({ id: 'a', source: 'elle', date: '2026-11-01', description: 'x', amount: -5, kind: 'gider', category: 'Diğer', needsReview: false, userEdited: true })
    await db.subs.put({ key: 'K', name: 'K', cancelled: true, cancelledAt: '2026-11-01', paymentLabels: {} })
    await saveSettings({ ownerName: 'A', neutralPeople: ['B'] })
    const blob = await exportBackup()
    await Promise.all([db.txns.clear(), db.subs.clear(), db.settings.clear()])
    await importBackup(new File([blob], 'y.json'))
    expect(await db.txns.count()).toBe(1)
    expect((await db.subs.get('K'))?.cancelled).toBe(true)
    expect(await getSettings()).toEqual({ ownerName: 'A', neutralPeople: ['B'] })
  })
  it('rejects an unknown version', async () => {
    await expect(importBackup(new File([JSON.stringify({ version: 2 })], 'y.json'))).rejects.toThrow()
  })
})
