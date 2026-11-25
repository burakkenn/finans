import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, saveSettings } from '../../src/db/db'
import { addRuleFromTxn, importFile } from '../../src/db/importFile'
import { makeXls } from '../helpers/makeXls'

const rows = [
  ['24/11/2026-16:45:15', '24/11/2026', 'Sistem', 330, 330, 0, 'FA', 'FAST', 'ALİ VELİ*0010**123*FAST', '', '', '', '', 'R1'],
  ['20/11/2026-15:54:15', '20/11/2026', 'İşCep', 15000, 21330, 0, 'HV', 'Havale', 'AYŞE YILMAZ tarafından aktarılan*AYŞE YILMAZ*H1', '', '', '', '', 'R2'],
  ['21/11/2026-15:54:15', '21/11/2026', 'İşCep', 3000, 24330, 0, 'HV', 'Havale', 'AYŞE YILMAZ tarafından aktarılan*AYŞE YILMAZ*H2', '', '', '', '', 'R3'],
]
const file = () => new File([makeXls('Vadesiz Hesap', true, rows)], 'hesap.xls')

beforeEach(async () => {
  await Promise.all([db.txns.clear(), db.rules.clear(), db.subs.clear(), db.settings.clear()])
  await saveSettings({ ownerName: 'Test Kişi', neutralPeople: [] })
})

describe('importFile', () => {
  it('adds new rows and counts review items', async () => {
    const r = await importFile(file())
    expect(r).toEqual({ added: 3, skipped: 0, review: 3, source: 'vadesiz' })
  })
  it('adds nothing when the same file is imported again', async () => {
    await importFile(file())
    const r = await importFile(file())
    expect(r.added).toBe(0)
    expect(r.skipped).toBe(3)
    expect(await db.txns.count()).toBe(3)
  })
  it('keeps user edits on re-import', async () => {
    await importFile(file())
    await db.txns.update('acc:R1:330.00', { category: 'Hediye', kind: 'gelir', userEdited: true, needsReview: false })
    await importFile(file())
    expect((await db.txns.get('acc:R1:330.00'))?.category).toBe('Hediye')
  })
  it('rejects unsupported files in Turkish', async () => {
    await expect(importFile(new File(['x'], 'not.txt'))).rejects.toThrow('Bu dosya türü desteklenmiyor')
  })
  it('a rule learned from one row reclassifies the same person', async () => {
    await importFile(file())
    const t = (await db.txns.get('acc:R2:15000.00'))!
    await addRuleFromTxn(t, 'counterparty', 'gelir', 'Harçlık')
    const other = (await db.txns.get('acc:R3:3000.00'))!
    expect(other).toMatchObject({ kind: 'gelir', category: 'Harçlık', needsReview: false })
  })
})
