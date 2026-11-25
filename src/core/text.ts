const MOJIBAKE: [string, string][] = [
  ['Ä°', 'İ'], ['Ã‡', 'Ç'], ['Ã–', 'Ö'], ['Ãœ', 'Ü'], ['Ä±', 'ı'], ['ÅŸ', 'ş'],
  ['ÄŸ', 'ğ'], ['Ã§', 'ç'], ['Ã¶', 'ö'], ['Ã¼', 'ü'], ['Åž', 'Ş'], ['Äž', 'Ğ'],
]

export function fixMojibake(s: string): string {
  let out = s
  for (const [bad, good] of MOJIBAKE) out = out.split(bad).join(good)
  return out
}

export function normTr(s: string): string {
  return fixMojibake(s).toLocaleUpperCase('tr-TR').replace(/İ/g, 'I').replace(/\s+/g, ' ').trim()
}

export function parseTrAmount(s: string): number {
  const m = s.replace(/\s/g, '').match(/-?[\d.]*\d,\d+/)
  if (!m) return NaN
  return Number(m[0].replace(/\./g, '').replace(',', '.'))
}

export function parseTrDate(s: string): { date: string; time?: string } {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})(?:-(\d{2}):(\d{2}))?/)
  if (!m) throw new Error(`Tarih okunamadı: ${s}`)
  const date = `${m[3]}-${m[2]}-${m[1]}`
  return m[4] ? { date, time: `${m[4]}:${m[5]}` } : { date }
}
