import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { IconSparkle, IconUpload } from '../icons'
import { useUploader } from '../useUploader'
import { exportBackup, importBackup } from '../../core/backup'
import type { Kind } from '../../core/types'
import { db, saveSettings } from '../../db/db'
import { countIncomingAsIncome, reclassifyAll } from '../../db/importFile'
import { normTr } from '../../core/text'
import { categoriesFor } from '../components/TxnEditor'
import { clearErrors, readErrors } from '../errorLog'
import { parseAmountInput } from '../format'
import type { ScreenProps } from '../shared'

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function NameCard({ initial, onSave }: { initial: string; onSave: (n: string) => void }) {
  const [name, setName] = useState(initial)
  return (
    <div className="card" style={{ background: 'var(--hero)', border: 0 }}>
      <h3>👋 Önce adını yaz</h3>
      <p className="small" style={{ color: 'var(--navy-soft)', marginTop: 4 }}>
        Kendi hesapların arasındaki transferleri tanımak için lazım. Sadece bu telefonda durur.
      </p>
      <label className="field">Adın soyadın (bankada yazdığı gibi)
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ad Soyad" />
      </label>
      <button className="btn block" style={{ marginTop: 12 }} disabled={!name.trim()} onClick={() => onSave(name.trim())}>Kaydet</button>
    </div>
  )
}

function ManualAdd({ txns, notify }: Pick<ScreenProps, 'txns' | 'notify'>) {
  const [kind, setKind] = useState<Exclude<Kind, 'notr'>>('gider')
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Yemek & kafe')
  const [note, setNote] = useState('')
  const cats = categoriesFor(kind, txns)

  async function add() {
    const n = parseAmountInput(amount)
    if (!n || n <= 0) { notify({ text: 'Tutarı yaz', error: true }); return }
    await db.txns.add({
      id: `elle:${crypto.randomUUID()}`, source: 'elle', date, description: note.trim() || category,
      amount: kind === 'gider' ? -n : n, kind, category: cats.includes(category) ? category : cats[0],
      needsReview: false, userEdited: true, note: note.trim() || undefined,
    })
    setAmount(''); setNote('')
    notify({ text: 'Eklendi' })
  }

  return (
    <div className="card">
      <h3>✍️ Elle ekle</h3>
      <p className="muted small">Nakit harcamalar ya da ekstrede olmayan şeyler için.</p>
      <div className="seg" style={{ marginTop: 10 }}>
        <button className={kind === 'gider' ? 'on' : ''} onClick={() => { setKind('gider'); setCategory(categoriesFor('gider', txns)[0]) }}>Gider</button>
        <button className={kind === 'gelir' ? 'on' : ''} onClick={() => { setKind('gelir'); setCategory(categoriesFor('gelir', txns)[0]) }}>Gelir</button>
      </div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field grow">Tutar (₺)<input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></label>
        <label className="field grow">Tarih<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      </div>
      <label className="field">Kategori
        <select value={category} onChange={e => setCategory(e.target.value)}>{cats.map(c => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="field">Not<input value={note} onChange={e => setNote(e.target.value)} placeholder="ör. simit" /></label>
      <button className="btn block" style={{ marginTop: 14 }} onClick={add}>Ekle</button>
    </div>
  )
}

function ErrorLogCard() {
  const [errors, setErrors] = useState(readErrors)
  if (!errors.length) return null
  return (
    <div className="card">
      <h3>🐞 Hata kaydı</h3>
      <p className="muted small">Uygulama bir hata yaşadı. Bu kartın ekran görüntüsünü Claude'a gönderirsen düzeltebilir.</p>
      {errors.slice(0, 3).map(e => (
        <div key={e.at} className="small" style={{ marginTop: 10, wordBreak: 'break-word' }}>
          <b>{e.where} · {e.at.slice(0, 16).replace('T', ' ')}</b>
          <div>{e.message}</div>
          <div className="muted" style={{ fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>{e.stack}</div>
        </div>
      ))}
      <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => { clearErrors(); setErrors([]) }}>Kaydı temizle</button>
    </div>
  )
}

export function Ayarlar({ txns, settings, notify, openReview }: ScreenProps) {
  const up = useUploader(notify)
  const restoreRef = useRef<HTMLInputElement>(null)
  const rules = useLiveQuery(() => db.rules.toArray(), []) ?? []

  async function backup() {
    const blob = await exportBackup()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `finans-yedek-${todayIso()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  async function restore(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    if (!confirm('Telefondaki mevcut veriler silinip yedekteki veriler yüklenecek. Devam edilsin mi?')) return
    try {
      await importBackup(f)
      notify({ text: 'Yedek geri yüklendi' })
    } catch (e) {
      notify({ text: (e as Error).message, error: true })
    }
    if (restoreRef.current) restoreRef.current.value = ''
  }

  async function saveName(ownerName: string) {
    await saveSettings({ ...settings, ownerName })
    await reclassifyAll()
    notify({ text: 'Kaydedildi' })
  }

  const reviewCount = txns.filter(t => t.needsReview).length

  return (
    <>
      <h1 className="title enter">Yükle & ayarlar</h1>

      {!settings.ownerName && <NameCard initial="" onSave={saveName} />}

      <div className="card enter" style={{ '--i': 1 } as React.CSSProperties}>
        <h3>📥 Ekstre yükle</h3>
        <p className="muted small">İşCep'ten indirdiğin kart ekstresi (PDF) ya da hesap hareketleri (Excel). Aynı dosyayı tekrar yüklersen bir şey çoğalmaz.</p>
        {up.input}
        <button className="btn block" style={{ marginTop: 12 }} disabled={up.busy} onClick={up.pick}>
          <IconUpload size={18} /> {up.busy ? 'Okunuyor…' : 'Dosya seç'}
        </button>
        {up.result && !up.result.errors.length && (
          <div className="card enter" style={{ background: 'var(--hero)', border: 0, color: 'var(--hero-text)' }}>
            <div className="row"><b>✅ {up.result.files} dosya okundu</b><button className="small" onClick={up.clearResult}>Kapat</button></div>
            <p className="small" style={{ marginTop: 6 }}>
              {up.result.added} yeni hareket eklendi{up.result.skipped ? `, ${up.result.skipped} tanesi zaten vardı` : ''}.
              {up.result.review > 0 ? ` ${up.result.review} tanesi ne olduğunu soruyor.` : ''}
            </p>
            {reviewCount > 0 && <button className="btn block" style={{ marginTop: 10 }} onClick={openReview}><IconSparkle size={18} /> Şimdi ayır</button>}
          </div>
        )}
      </div>

      <button className="card enter press" style={{ '--i': 2, width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 } as React.CSSProperties} onClick={openReview}>
        <span style={{ fontSize: 26 }}>🧐</span>
        <span className="grow"><h3>Bunlar ne?</h3><span className="muted small">{reviewCount ? `${reviewCount} hareket ne olduğunu soruyor` : 'Sorulacak hareket yok 🎉'}</span></span>
        {reviewCount > 0 && <span className="chip">{reviewCount}</span>}
      </button>

      <ManualAdd txns={txns} notify={notify} />

      <div className="card">
        <h3>💾 Yedek</h3>
        <p className="muted small">Veriler sadece bu telefonda. Ayda bir yedek al, dosyayı Drive'a ya da bir yere koy.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn tonal grow" onClick={backup}>Yedek al</button>
          <button className="btn ghost grow" onClick={() => restoreRef.current?.click()}>Yedekten yükle</button>
        </div>
        <input ref={restoreRef} type="file" accept=".json,application/json" hidden onChange={e => restore(e.target.files)} />
      </div>

      <div className="card">
        <h3>⚙️ Ayarlar</h3>
        {settings.ownerName && (
          <div className="list-row"><span className="grow">Adın</span><b>{settings.ownerName}</b>
            <button className="btn ghost small" onClick={() => { const n = prompt('Adın soyadın', settings.ownerName); if (n?.trim()) saveName(n.trim()) }}>Değiştir</button>
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <b className="small">Sayılmayan kişiler</b>
          {settings.neutralPeople.length === 0 && <p className="muted small">Yok</p>}
          {settings.neutralPeople.map(p => {
            const inRule = rules.find(r => r.field === 'counterparty' && r.direction === 'in' && normTr(r.match) === p && r.kind === 'gelir')
            return (
              <div className="list-row" key={p} style={{ flexWrap: 'wrap' }}>
                <span className="grow">{p}<br /><span className="muted small">{inRule ? `Gelenler gelir (${inRule.category}), gidenler sayılmıyor` : 'Gelen de giden de sayılmıyor'}</span></span>
                {inRule
                  ? <button className="btn ghost small" onClick={async () => { await db.rules.delete(inRule.id); await reclassifyAll() }}>Gelenleri sayma</button>
                  : <button className="btn tonal small" onClick={async () => { await countIncomingAsIncome(p); notify({ text: 'Bu kişiden gelenler artık gelir' }) }}>Gelenleri gelir say</button>}
                <button className="btn ghost small" onClick={async () => { await saveSettings({ ...settings, neutralPeople: settings.neutralPeople.filter(x => x !== p) }); await reclassifyAll() }}>Kaldır</button>
              </div>
            )
          })}
        </div>
        <div style={{ marginTop: 12 }}>
          <b className="small">Öğrendiğim kurallar</b>
          {rules.length === 0 && <p className="muted small">Henüz yok</p>}
          {rules.map(r => (
            <div className="list-row" key={r.id}>
              <span className="grow ellipsis">{r.match}{r.direction === 'in' ? ' (gelen)' : r.direction === 'out' ? ' (giden)' : ''} → {r.kind === 'notr' ? 'Sayılmaz' : r.category}</span>
              <button className="btn ghost small" onClick={async () => { await db.rules.delete(r.id); await reclassifyAll() }}>Sil</button>
            </div>
          ))}
        </div>
      </div>
      <ErrorLogCard />
      <p className="muted small" style={{ textAlign: 'center', padding: 16 }}>Finans · veriler sadece bu cihazda</p>
    </>
  )
}
