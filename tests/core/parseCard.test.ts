import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCardLines, parseCardPdf, type TextLine } from '../../src/core/parseCard'

// Real layout: TUTAR header item at x=400 w=28, "TAKSİT BİLGİSİ MAXIPUAN" at x=448, puan values at x≈551
const header: TextLine = { page: 1, y: 487, items: [
  { str: 'TARİHİ', x: 58, y: 487, w: 30 }, { str: 'AÇIKLAMA', x: 136, y: 487, w: 46 },
  { str: 'TUTAR', x: 400, y: 487, w: 28 }, { str: 'TAKSİT BİLGİSİ MAXIPUAN', x: 448, y: 487, w: 118 },
] }
let y = 480
const line = (...items: [string, number, number][]): TextLine => {
  y -= 12
  return { page: 1, y, items: items.map(([str, x, w]) => ({ str, x, y, w })) }
}

describe('parseCardLines', () => {
  const lines: TextLine[] = [
    { page: 1, y: 611, items: [{ str: 'Son Ödeme Tarihi: 27/11/2026', x: 173, y: 611, w: 103 }] },
    header,
    line(['******** BİR ÖNCEKİ HESAP ÖZETİ BAKİYENİZ ***', 48, 174], ['9.000,00', 397, 31]),
    line(['18/10/2026 IYZICO/TIKLAGELSIN.COM ISTANBUL TR', 61, 172], ['217,00', 407, 22], ['0,02', 551, 14]),
    line(['18/10/2026 1000-111111 HESAPTAN AKTARIM 1000 İNTERAKTİF', 61, 213], ['-750,00', 403, 25]),
    line(['04/11/2026 OTOBİTE OTOMAT GIDAİNŞ.İSTANBULTR', 61, 170], ['18,00', 411, 18]),
    line(['04/11/2026 OTOBİTE OTOMAT GIDAİNŞ.İSTANBULTR', 61, 170], ['18,00', 411, 18]),
    line(['Belge Numarası: 143 - 1', 18, 84], ['23/10/2026 MC DONALDS ISTANBUL TR', 61, 150], ['170,00', 407, 22]),
    line(['14/11/2026 Ä°ADE/IYZICO/TIKLAGELSIN.COM', 61, 149], ['-549,00', 403, 25], ['-0,05', 548, 17]),
    line(['AYLIK TAKSİTLİ BORÇ TOPLAMI: 0,00', 101, 124]),
    line(['TOPLAM', 136, 36], ['8.000,00', 387, 33], ['TL', 422, 7], ['1,51', 543, 15]),
  ]
  const t = parseCardLines(lines)

  it('reads only transaction rows', () => {
    expect(t.length).toBe(6)
  })
  it('stores purchases as money out, ignoring the MaxiPuan column', () => {
    expect(t[0]).toMatchObject({ source: 'kart', date: '2026-10-18', amount: -217, description: 'IYZICO/TIKLAGELSIN.COM ISTANBUL TR' })
  })
  it('stores card payments as money in', () => {
    expect(t[1].amount).toBe(750)
  })
  it('gives identical same-day purchases different ids', () => {
    expect(t[2].id.endsWith('|0')).toBe(true)
    expect(t[3].id.endsWith('|1')).toBe(true)
    expect(t[2].id).not.toBe(t[3].id)
  })
  it('ignores the sideways document number on the same line', () => {
    expect(t[4].description).toBe('MC DONALDS ISTANBUL TR')
  })
  it('turns a mojibake refund into a positive İADE row', () => {
    expect(t[5].amount).toBe(549)
    expect(t[5].description.startsWith('İADE')).toBe(true)
  })
})

const real = 'fixtures-private/kart-ekstre.pdf'
it.skipIf(!existsSync(real))('real statement balances: previous + purchases - payments = debt', async () => {
  const b = readFileSync(real)
  const t = await parseCardPdf(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  const net = t.reduce((s, x) => s + x.amount, 0) // purchases negative, payments positive
  expect(Math.round((-net) * 100) / 100).toBeCloseTo(8000 - 9000, 2)
  expect(t.length).toBeGreaterThan(100)
})
