import * as XLSX from 'xlsx'
import * as cptable from 'xlsx/dist/cpexcel.full.mjs'
import { normTr, parseTrDate } from './text'
import type { RawTxn } from './types'

XLSX.set_cptable(cptable)

type Cell = string | number | boolean | null | undefined

function cellText(c: Cell): string {
  return c === null || c === undefined ? '' : String(c).trim()
}

function toAmount(c: Cell): number {
  if (typeof c === 'number') return c
  const s = cellText(c).replace(/\./g, '').replace(',', '.')
  return Number(s)
}

function counterpartyOf(bankType: string, description: string): string | undefined {
  if (!/FAST|HAVALE|EFT/i.test(normTr(bankType))) return undefined
  const first = description.split('*')[0].replace(/\s+tarafından aktar[ıi]lan\s*$/i, '')
  const n = normTr(first)
  return n || undefined
}

export function parseAccountXls(buf: ArrayBuffer): { source: 'vadesiz' | 'vadeli'; txns: RawTxn[] } {
  const wb = XLSX.read(buf, { type: 'array', codepage: 1254 })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: '' })

  let source: 'vadesiz' | 'vadeli' | undefined
  let headerIdx = -1
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map(cellText)
    const labelAt = cells.findIndex(c => c.startsWith('Ürün-Döviz Tipi'))
    if (labelAt >= 0) {
      const value = cells.slice(labelAt + 1).find(c => c !== '') ?? ''
      source = /Vadeli/i.test(value) ? 'vadeli' : 'vadesiz'
    }
    if (cells[0] === 'Tarih/Saat') { headerIdx = i; break }
  }
  if (headerIdx < 0) throw new Error('Bu dosya İş Bankası hesap hareketi dosyasına benzemiyor')

  const header = rows[headerIdx].map(cellText)
  const col = (name: string) => {
    const i = header.findIndex(h => h.startsWith(name))
    if (i < 0) throw new Error(`Sütun bulunamadı: ${name}`)
    return i
  }
  const cDate = col('Tarih/Saat'), cAmount = col('İşlem Tutarı'), cType = col('İşlem Tipi')
  const cDesc = col('Açıklama'), cRef = col('Referans')

  const txns: RawTxn[] = []
  const seen = new Map<string, number>()
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]
    const dateCell = cellText(r[cDate])
    if (!dateCell) break
    const amount = toAmount(r[cAmount])
    if (!amount) continue
    const { date, time } = parseTrDate(dateCell)
    const bankType = cellText(r[cType])
    const description = cellText(r[cDesc])
    const baseId = `acc:${cellText(r[cRef])}:${amount.toFixed(2)}`
    const n = seen.get(baseId) ?? 0
    seen.set(baseId, n + 1)
    const t: RawTxn = { id: n ? `${baseId}:${n}` : baseId, source: source ?? 'vadesiz', date, time, description, amount, bankType }
    const cp = counterpartyOf(bankType, description)
    if (cp) t.counterparty = cp
    txns.push(t)
  }
  return { source: source ?? 'vadesiz', txns }
}
