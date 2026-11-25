import { useState } from 'react'
import { normTr } from '../../core/text'
import type { Kind, Txn } from '../../core/types'
import { db, getSettings, saveSettings } from '../../db/db'
import { addRuleFromTxn, reclassifyAll } from '../../db/importFile'
import { formatTL, shortDate } from '../format'
import type { ToastMsg } from './Toast'
import { TxnEditor } from './TxnEditor'

type Choice = { label: string; kind: Kind; category: string; neutralPerson?: boolean }

function choicesFor(t: Txn): Choice[] {
  if (t.amount > 0) {
    return [
      { label: '💸 Harçlık', kind: 'gelir', category: 'Harçlık' },
      ...(t.counterparty ? [{ label: '🤝 Arkadaş geri ödedi', kind: 'gider' as Kind, category: 'Arkadaşlarla ödeşme' }] : []),
      { label: '➕ Diğer gelir', kind: 'gelir', category: 'Diğer gelir' },
      t.counterparty
        ? { label: '🚫 Sayılmasın', kind: 'notr', category: 'Kişiler', neutralPerson: true }
        : { label: '🔄 Kendi hesabım', kind: 'notr', category: 'Kendi hesaplarım' },
    ]
  }
  if (t.counterparty) {
    return [
      { label: '🤝 Arkadaşa ödeme', kind: 'gider', category: 'Arkadaşlarla ödeşme' },
      { label: '📦 Başka harcama', kind: 'gider', category: 'Diğer' },
      { label: '🚫 Sayılmasın', kind: 'notr', category: 'Kişiler', neutralPerson: true },
      { label: '🔄 Kendi hesabım', kind: 'notr', category: 'Kendi hesaplarım' },
    ]
  }
  return [
    { label: '🍔 Yemek & kafe', kind: 'gider', category: 'Yemek & kafe' },
    { label: '🛒 Market', kind: 'gider', category: 'Market' },
    { label: '🛍️ Alışveriş', kind: 'gider', category: 'Alışveriş' },
    { label: '📦 Diğer', kind: 'gider', category: 'Diğer' },
  ]
}

function ReviewCard({ t, txns, notify }: { t: Txn; txns: Txn[]; notify: (m: ToastMsg) => void }) {
  const [always, setAlways] = useState(true)
  const [editing, setEditing] = useState(false)

  async function apply(c: Choice) {
    try {
      if (c.neutralPerson && t.counterparty && always) {
        const s = await getSettings()
        const cp = normTr(t.counterparty)
        if (!s.neutralPeople.includes(cp)) await saveSettings({ ...s, neutralPeople: [...s.neutralPeople, cp] })
        await reclassifyAll()
      } else if (always) {
        await addRuleFromTxn(t, t.counterparty ? 'counterparty' : 'description', c.kind, c.category)
      } else {
        await db.txns.update(t.id, { kind: c.kind, category: c.category, userEdited: true, needsReview: false })
      }
    } catch (e) {
      notify({ text: (e as Error).message, error: true })
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <b style={{ wordBreak: 'break-word' }}>{t.counterparty ?? t.description}</b>
          <p className="muted small" style={{ marginTop: 2 }}>{shortDate(t.date)} · {t.source === 'kart' ? 'Kart' : 'Hesap'}</p>
        </div>
        <b className={`money ${t.amount > 0 ? 'pos' : ''}`}>{formatTL(t.amount, true)}</b>
      </div>
      <div className="qgrid">
        {choicesFor(t).map(c => <button key={c.label} className="q" onClick={() => apply(c)}>{c.label}</button>)}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <label className="check" style={{ marginTop: 0, fontSize: 13 }}>
          <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} />
          {t.counterparty ? 'Bu kişi için hep böyle' : 'Bu işyeri için hep böyle'}
        </label>
        <button className="btn ghost small" onClick={() => setEditing(true)}>Başka…</button>
      </div>
      {editing && <TxnEditor txn={t} txns={txns} onClose={() => setEditing(false)} notify={notify} />}
    </div>
  )
}

export function ReviewQueue({ txns, notify }: { txns: Txn[]; notify: (m: ToastMsg) => void }) {
  const items = txns.filter(t => t.needsReview).sort((a, b) => b.date.localeCompare(a.date))
  if (!items.length) return <p className="muted small" style={{ padding: '8px 4px' }}>Sorulacak hareket yok. 🎉</p>
  return (
    <>
      <p className="muted small" style={{ padding: '0 4px' }}>
        Bunların ne olduğunu bir kere söylersen, “hep böyle” açıkken benzerlerini kendim ayırırım.
      </p>
      {items.slice(0, 15).map(t => <ReviewCard key={t.id} t={t} txns={txns} notify={notify} />)}
      {items.length > 15 && <p className="muted small" style={{ padding: 8 }}>+{items.length - 15} hareket daha</p>}
    </>
  )
}
