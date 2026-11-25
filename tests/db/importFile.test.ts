import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, saveSettings } from '../../src/db/db'
import { addRuleFromTxn, countIncomingAsIncome, importFile, markNeutralPerson } from '../../src/db/importFile'
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

describe('rule learning safety (review C1, C2, I1)', () => {
  const cardTxn = (id: string, description: string, amount: number) => ({
    id, source: 'kart' as const, date: '2026-11-01', description, amount, kind: 'gider' as const, category: 'Diğer', needsReview: true, userEdited: false,
  })
  it('a rule never gets an empty or tiny match', async () => {
    const t = cardTxn('c1', 'ISTANBUL TR', -50)
    await db.txns.put(t)
    await addRuleFromTxn(t, 'description', 'gider', 'Ulaşım')
    const rules = await db.rules.toArray()
    expect(rules.every(r => r.match.length >= 3)).toBe(true)
  })
  it('choosing income for a card refund does not create a rule that flips purchases', async () => {
    const refund = cardTxn('c2', 'İADE/FOOSHOP.COM', 100)
    const buy = cardTxn('c3', 'FOOSHOP.COM ISTANBUL TR', -100)
    await db.txns.bulkPut([refund, buy])
    await addRuleFromTxn(refund, 'description', 'gelir', 'Diğer gelir')
    expect((await db.txns.get('c3'))?.kind).toBe('gider')
    expect(await db.rules.count()).toBe(0)
    expect((await db.txns.get('c2'))).toMatchObject({ kind: 'gelir', userEdited: true, needsReview: false })
  })
  it('re-teaching the same merchant replaces the old rule', async () => {
    const t = cardTxn('c4', 'MIGROS ISTANBUL TR', -100)
    await db.txns.put(t)
    await addRuleFromTxn(t, 'description', 'gider', 'Market')
    await addRuleFromTxn(t, 'description', 'gider', 'Yemek & kafe')
    const rules = await db.rules.toArray()
    expect(rules.length).toBe(1)
    expect((await db.txns.get('c4'))?.category).toBe('Yemek & kafe')
  })
  it('marking a person neutral removes their earlier rule', async () => {
    await importFile(file())
    const t = (await db.txns.get('acc:R2:15000.00'))!
    await addRuleFromTxn(t, 'counterparty', 'gelir', 'Harçlık')
    await markNeutralPerson('AYŞE YILMAZ')
    expect(await db.rules.count()).toBe(0)
    expect((await db.txns.get('acc:R3:3000.00'))).toMatchObject({ kind: 'notr', category: 'Kişiler' })
  })
})

describe('rules learned from a person remember the direction', () => {
  it('teaching an incoming transfer does not change outgoing ones', async () => {
    const rows2 = [
      ['20/11/2026-15:54:15', '20/11/2026', 'İşCep', 400, 400, 0, 'FA', 'FAST', 'VELİ ÇAM*0010**1*FAST', '', '', '', '', 'P1'],
      ['21/11/2026-15:54:15', '21/11/2026', 'İşCep', -300, 100, 0, 'FA', 'FAST', 'VELİ ÇAM*TR1*X tarafından aktarılan', '', '', '', '', 'P2'],
    ]
    await importFile(new File([makeXls('Vadesiz Hesap', true, rows2)], 'h2.xls'))
    const incoming = (await db.txns.get('acc:P1:400.00'))!
    await addRuleFromTxn(incoming, 'counterparty', 'gelir', 'Diğer gelir')
    expect((await db.txns.get('acc:P2:-300.00'))?.kind).toBe('gider')
    expect((await db.rules.toArray())[0].direction).toBe('in')
  })
})

describe('countIncomingAsIncome', () => {
  it('turns money received from a neutral person into income under their first name, outgoing stays neutral', async () => {
    const rows3 = [
      ['20/11/2026-15:54:15', '20/11/2026', 'İşCep', 400, 400, 0, 'FA', 'FAST', 'ŞULE ÖZ*0010**1*FAST', '', '', '', '', 'Q1'],
      ['21/11/2026-15:54:15', '21/11/2026', 'İşCep', -300, 100, 0, 'FA', 'FAST', 'ŞULE ÖZ*TR1*X tarafından aktarılan', '', '', '', '', 'Q2'],
    ]
    await importFile(new File([makeXls('Vadesiz Hesap', true, rows3)], 'h3.xls'))
    await markNeutralPerson('ŞULE ÖZ')
    await countIncomingAsIncome('ŞULE ÖZ')
    expect(await db.txns.get('acc:Q1:400.00')).toMatchObject({ kind: 'gelir', category: 'Şule' })
    expect(await db.txns.get('acc:Q2:-300.00')).toMatchObject({ kind: 'notr', category: 'Kişiler' })
  })
})
