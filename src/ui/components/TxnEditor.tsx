import { useMemo, useState } from 'react'
import { periodAnchorIds } from '../../core/periods'
import type { Kind, Txn } from '../../core/types'
import { db } from '../../db/db'
import { addRuleFromTxn, markNeutralPerson } from '../../db/importFile'
import { BASE_CATEGORIES, dayLabel, displayTitle, formatTL } from '../format'
import type { ToastMsg } from './Toast'

const NEUTRAL_CATS = ['Kişiler', 'Kendi hesaplarım', 'Kart ödemesi', 'Nakit']
const KIND_LABEL: Record<Kind, string> = { gider: 'Gider', gelir: 'Gelir', notr: 'Sayılmasın' }

export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="handle" />
        {children}
      </div>
    </div>
  )
}

export function categoriesFor(kind: Kind, txns: Txn[]): string[] {
  if (kind === 'notr') return NEUTRAL_CATS
  const used = txns.filter(t => t.kind === kind).map(t => t.category)
  return [...new Set([...BASE_CATEGORIES[kind], ...used])]
}

export function TxnEditor({ txn, txns, onClose, notify }: { txn: Txn; txns: Txn[]; onClose: () => void; notify: (m: ToastMsg) => void }) {
  const [kind, setKind] = useState<Kind>(txn.kind)
  const [category, setCategory] = useState(txn.category)
  const [newCat, setNewCat] = useState('')
  const [note, setNote] = useState(txn.note ?? '')
  const [always, setAlways] = useState(false)
  const [neutralPerson, setNeutralPerson] = useState(false)
  const wasAnchor = useMemo(() => periodAnchorIds(txns).has(txn.id), [txns, txn.id])
  const [startsPeriod, setStartsPeriod] = useState(wasAnchor)
  const cats = categoriesFor(kind, txns)

  function pickKind(k: Kind) {
    setKind(k)
    const list = categoriesFor(k, txns)
    if (!list.includes(category)) setCategory(list[0])
  }

  async function save() {
    try {
      if (neutralPerson && txn.counterparty) {
        await db.txns.update(txn.id, { note: note || undefined })
        await markNeutralPerson(txn.counterparty)
        notify({ text: `${txn.counterparty} ile transferler artık sayılmayacak` })
        onClose()
        return
      }
      const finalCat = category === '__new' ? newCat.trim() || 'Diğer' : category
      await db.txns.update(txn.id, {
        kind, category: finalCat, note: note || undefined, userEdited: true, needsReview: false,
        ...(startsPeriod !== wasAnchor ? { periodStart: startsPeriod } : {}),
      })
      if (always) {
        await addRuleFromTxn(txn, txn.counterparty ? 'counterparty' : 'description', kind, finalCat)
        notify({ text: 'Kaydedildi, benzerleri de güncellendi' })
      } else notify({ text: 'Kaydedildi' })
      onClose()
    } catch (e) {
      notify({ text: (e as Error).message, error: true })
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <h3 style={{ wordBreak: 'break-word' }}>{displayTitle(txn)}</h3>
          <p className="muted small" style={{ marginTop: 4 }}>{dayLabel(txn.date)}{txn.time ? ` · ${txn.time}` : ''}</p>
          {displayTitle(txn) !== txn.description && <p className="muted small" style={{ marginTop: 2, wordBreak: 'break-word' }}>{txn.description}</p>}
        </div>
        <b className={`money ${txn.amount > 0 ? 'pos' : ''}`} style={{ fontSize: 18 }}>{formatTL(txn.amount, true)}</b>
      </div>

      {!neutralPerson && (
        <>
          <label className="field">Türü
            <div className="seg">
              {(['gider', 'gelir', 'notr'] as Kind[]).map(k => (
                <button key={k} className={kind === k ? 'on' : ''} onClick={() => pickKind(k)}>{KIND_LABEL[k]}</button>
              ))}
            </div>
          </label>
          {kind === 'gider' && txn.amount > 0 && <p className="muted small" style={{ marginTop: 6 }}>Gelen para bu kategorideki gideri azaltır (iade / geri ödeme gibi).</p>}
          <label className="field">Kategori
            <select value={category} onChange={e => setCategory(e.target.value)}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
              {kind !== 'notr' && <option value="__new">+ Yeni kategori…</option>}
            </select>
          </label>
          {category === '__new' && (
            <label className="field">Yeni kategori adı<input value={newCat} onChange={e => setNewCat(e.target.value)} autoFocus /></label>
          )}
        </>
      )}

      <label className="field">Not<input value={note} onChange={e => setNote(e.target.value)} placeholder="İsteğe bağlı" /></label>

      {!neutralPerson && (
        <label className="check"><input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} />
          {txn.counterparty ? `Bu kişi${txn.amount > 0 ? 'den gelen' : 'ye giden'} paralar için hep böyle yap` : 'Bu işyeri için bundan sonra hep böyle yap'}
        </label>
      )}
      {!neutralPerson && kind === 'gelir' && txn.amount > 0 && (
        <label className="check"><input type="checkbox" checked={startsPeriod} onChange={e => setStartsPeriod(e.target.checked)} />
          Yeni dönem başlatsın (aylık asıl harçlık)
        </label>
      )}
      {txn.counterparty && (
        <label className="check"><input type="checkbox" checked={neutralPerson} onChange={e => setNeutralPerson(e.target.checked)} />
          Bu kişiyle transferler hiç sayılmasın
        </label>
      )}

      <button className="btn block" style={{ marginTop: 18 }} onClick={save}>Kaydet</button>
    </Sheet>
  )
}
