import * as XLSX from 'xlsx'

export function makeXls(product: string, withEkHesap: boolean, rows: (string | number)[][]): ArrayBuffer {
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

