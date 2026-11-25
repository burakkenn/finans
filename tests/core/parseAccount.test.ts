import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseAccountXls } from '../../src/core/parseAccount'

function makeXls(product: string, withEkHesap: boolean, rows: (string | number)[][]): ArrayBuffer {
  const head = withEkHesap
    ? ['Tarih/Saat', 'Valör', 'Kanal/Şube', 'İşlem Tutarı*', 'Bakiye', 'Ek Hesap\nBakiyesi', 'İşlem', 'İşlem Tipi', 'Açıklama', '', '', '', '', 'Referans']
    : ['Tarih/Saat', 'Valör', 'Kanal/Şube', 'İşlem Tutarı*', 'Bakiye', 'İşlem', 'İşlem Tipi', 'Açıklama', '', '', '', '', '', 'Referans']
  const aoa = [
    ['HESAP ÖZETİ'],
    ['', '', 'Sayın TEST KİŞİ'],
    ['', '', 'Ürün-Döviz Tipi:', '', product],
    [],
    head,
    ...rows,
    [],
    ["(*) Çekilen tutar '-' ile gösterilmiştir."],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'S')
  const out = XLSX.write(wb, { bookType: 'biff8', type: 'array' }) as ArrayBuffer
  return out
}

const vadesizRows = [
  ['24/11/2026-16:45:15', '24/11/2026', 'Sistem', 330, 330, 0, 'FA', 'FAST', 'ALİ VELİ*0010**123*FAST', '', '', '', '', 'R1'],
  ['24/11/2026-01:22:13', '24/11/2026', 'Sistem', 0, 330, 0, 'FB', 'Faiz', 'VADE ...', '', '', '', '', 'R2'],
  ['25/11/2026-14:06:18', '25/11/2026', 'Diğer', -1500.25, 269.43, 0, 'AN', 'Para Çekme', '0143/1-MUHASEBE HESABINA İSCEP KRE.KART BORÇ ÖDEME', '', '', '', '', 'R3'],
  ['20/11/2026-15:54:15', '20/11/2026', 'İşCep', 15000, 15269.43, 0, 'HV', 'Havale', 'AYŞE YILMAZ tarafından aktarılan*AYŞE YILMAZ*H261', '', '', '', '', 'R4'],
]

describe('parseAccountXls', () => {
  it('reads vadesiz account rows, drops zero rows, extracts counterparty', () => {
    const r = parseAccountXls(makeXls('Vadesiz Hesap', true, vadesizRows))
    expect(r.source).toBe('vadesiz')
    expect(r.txns.length).toBe(3)
    expect(r.txns[0]).toMatchObject({ id: 'acc:R1:330.00', date: '2026-11-24', time: '16:45', amount: 330, bankType: 'FAST', counterparty: 'ALI VELI', source: 'vadesiz' })
    expect(r.txns[1].amount).toBe(-1500.25)
    expect(r.txns[1].counterparty).toBeUndefined()
  })
  it('strips "tarafından aktarılan" from havale counterparty', () => {
    const r = parseAccountXls(makeXls('Vadesiz Hesap', true, vadesizRows))
    expect(r.txns[2].counterparty).toBe('AYŞE YILMAZ')
  })
  it('finds columns by header in the vadeli layout', () => {
    const r = parseAccountXls(makeXls('Vadeli Hesap', false, [
      ['25/11/2026-01:22:13', '25/11/2026', 'Sistem', 37.78, 49290.55, 'TM', 'Vadeli - Faiz Verme', 'BRÜT FAİZ %28.00', '', '', '', '', '', 'V1'],
    ]))
    expect(r.source).toBe('vadeli')
    expect(r.txns[0]).toMatchObject({ id: 'acc:V1:37.78', amount: 37.78, bankType: 'Vadeli - Faiz Verme' })
  })
  it('gives identical ids when parsed twice', () => {
    const b = makeXls('Vadesiz Hesap', true, vadesizRows)
    expect(parseAccountXls(b).txns.map(t => t.id)).toEqual(parseAccountXls(b).txns.map(t => t.id))
  })
  for (const f of ['hesap-vadesiz.xls', 'hesap-vadeli.xls']) {
    const p = `fixtures-private/${f}`
    it.skipIf(!existsSync(p))(`parses real file ${f}`, () => {
      const buf = readFileSync(p)
      const r = parseAccountXls(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      expect(r.txns.length).toBeGreaterThan(20)
      expect(new Set(r.txns.map(t => t.id)).size).toBe(r.txns.length)
      for (const t of r.txns) {
        expect(t.description.length).toBeGreaterThan(0)
        expect(t.description).not.toContain('�')
        expect(t.amount).not.toBe(0)
      }
    })
  }
})

describe('parseAccountXls shared reference', () => {
  it('keeps a transfer and its fee apart when the bank gives them the same reference', () => {
    const r = parseAccountXls(makeXls('Vadesiz Hesap', true, [
      ['15/07/2026-21:21:42', '15/07/2026', 'İşCep', -8.37, 100, 0, 'FA', 'FAST', 'ÜCRET H1 200,00 TRY', '', '', '', '', 'SAME'],
      ['15/07/2026-21:21:42', '15/07/2026', 'İşCep', -200, 108.37, 0, 'FA', 'FAST', 'ALİ VELİ*TR1*X tarafından aktar', '', '', '', '', 'SAME'],
    ]))
    expect(new Set(r.txns.map(t => t.id)).size).toBe(2)
  })
})
