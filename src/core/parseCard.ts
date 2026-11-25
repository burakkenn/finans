import { fixMojibake, normTr, parseTrAmount, parseTrDate } from './text'
import type { RawTxn } from './types'

export interface TextItem { str: string; x: number; y: number; w: number }
export interface TextLine { y: number; page: number; items: TextItem[] }

const DATE_RE = /^(\d{2}\/\d{2}\/\d{4})\s*(.*)$/
const AMOUNT_RE = /^-?[\d.]+,\d{2}$/
const SKIP_RE = /ÖNCEKİ HESAP ÖZETİ|TOPLAM|TAKSİTLİ BORÇ/

export function parseCardLines(lines: TextLine[]): RawTxn[] {
  const out: RawTxn[] = []
  const seen = new Map<string, number>()
  let cols: { page: number; y: number; tutarX: number; puanX: number } | undefined

  for (const line of lines) {
    const items = [...line.items].sort((a, b) => a.x - b.x)
    const tutar = items.find(i => i.str.trim() === 'TUTAR')
    const puan = items.find(i => i.str.includes('MAXIPUAN'))
    if (tutar && puan) { cols = { page: line.page, y: line.y, tutarX: tutar.x, puanX: puan.x }; continue }
    if (!cols || cols.page !== line.page || line.y >= cols.y) continue

    const text = items.map(i => i.str).join(' ')
    if (SKIP_RE.test(text)) continue
    const dateItem = items.find(i => DATE_RE.test(i.str.trim()))
    if (!dateItem) continue
    const m = dateItem.str.trim().match(DATE_RE)!

    const amountItem = items.find(i => i.x >= cols!.tutarX - 40 && i.x < cols!.puanX && AMOUNT_RE.test(i.str.trim()))
    if (!amountItem) continue

    const descParts = [m[2], ...items.filter(i => i !== dateItem && i !== amountItem && i.x > dateItem.x && i.x < cols!.tutarX - 40).map(i => i.str)]
    const description = fixMojibake(descParts.join(' ')).replace(/\s+/g, ' ').trim()
    const amount = -parseTrAmount(amountItem.str)
    const date = parseTrDate(m[1]).date
    const base = `card:${date}|${normTr(description)}|${amount.toFixed(2)}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.push({ id: `${base}|${n}`, source: 'kart', date, description, amount })
  }
  return out
}

export async function extractPdfLines(buf: ArrayBuffer): Promise<TextLine[]> {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const lines: TextLine[] = []
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    const pageLines: TextLine[] = []
    for (const raw of tc.items) {
      if (!('str' in raw) || !raw.str.trim()) continue
      const item: TextItem = { str: raw.str, x: raw.transform[4], y: raw.transform[5], w: raw.width }
      const ln = pageLines.find(l => Math.abs(l.y - item.y) < 2)
      if (ln) ln.items.push(item)
      else pageLines.push({ y: item.y, page: p, items: [item] })
    }
    pageLines.sort((a, b) => b.y - a.y)
    lines.push(...pageLines)
  }
  return lines
}

export async function parseCardPdf(buf: ArrayBuffer): Promise<RawTxn[]> {
  const txns = parseCardLines(await extractPdfLines(buf))
  if (!txns.length) throw new Error('Bu PDF\'te kart hareketi bulunamadı')
  return txns
}

type Pdfjs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<Pdfjs> | undefined
function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (async () => {
    if (typeof window === 'undefined') {
      return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as Pdfjs
    }
    const lib = await import('pdfjs-dist')
    const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    lib.GlobalWorkerOptions.workerSrc = worker.default
    return lib
  })()
  return pdfjsPromise
}
