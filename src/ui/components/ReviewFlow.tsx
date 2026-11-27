import { useMemo, useRef, useState } from 'react'
import type { Kind, Txn } from '../../core/types'
import { db } from '../../db/db'
import { addRuleFromTxn, markNeutralPerson } from '../../db/importFile'
import { restoreSnapshot, takeSnapshot, type Snapshot } from '../../db/undo'
import { dayLabel, displayTitle, formatTL } from '../format'
import { haptic } from '../hooks'
import { IconUndo, IconX } from '../icons'
import type { ToastMsg } from './Toast'
import { TxnEditor } from './TxnEditor'

type Choice = { label: string; kind: Kind; category: string; neutralPerson?: boolean }

function choicesFor(t: Txn): Choice[] {
  if (t.source === 'kart' && t.amount > 0) {
    // card refund: it reduces spending in the shop's category
    return [
      { label: '🍔 Yemek iadesi', kind: 'gider', category: 'Yemek & kafe' },
      { label: '🛒 Market iadesi', kind: 'gider', category: 'Market' },
      { label: '🛍️ Alışveriş iadesi', kind: 'gider', category: 'Alışveriş' },
      { label: '📦 Diğer iade', kind: 'gider', category: 'Diğer' },
    ]
  }
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

export function ReviewFlow({ txns, onClose, notify }: { txns: Txn[]; onClose: () => void; notify: (m: ToastMsg) => void }) {
  const queue = useMemo(() => txns.filter(t => t.needsReview).sort((a, b) => b.date.localeCompare(a.date)), [txns])
  const [skipped, setSkipped] = useState<string[]>([])
  const [always, setAlways] = useState(true)
  const [leaving, setLeaving] = useState<'l' | 'r'>()
  const [editing, setEditing] = useState(false)
  const history = useRef<{ snap: Snapshot; skipped: string[] }[]>([])
  const startCount = useRef(Math.max(queue.length, 1))
  const visible = queue.filter(t => !skipped.includes(t.id))
  const t = visible[0]
  const doneCount = Math.max(0, startCount.current - visible.length)

  async function run(dir: 'l' | 'r', action: () => Promise<void>) {
    haptic()
    history.current.push({ snap: await takeSnapshot(), skipped })
    setLeaving(dir)
    await new Promise(r => setTimeout(r, 230))
    try { await action() } catch (e) { notify({ text: (e as Error).message, error: true }) }
    setLeaving(undefined)
  }

  function apply(c: Choice) {
    return run('l', async () => {
      if (c.neutralPerson && t.counterparty && always) await markNeutralPerson(t.counterparty)
      else if (always) await addRuleFromTxn(t, t.counterparty ? 'counterparty' : 'description', c.kind, c.category)
      else await db.txns.update(t.id, { kind: c.kind, category: c.category, userEdited: true, needsReview: false })
    })
  }

  async function undo() {
    const last = history.current.pop()
    if (!last) return
    haptic(20)
    await restoreSnapshot(last.snap)
    setSkipped(last.skipped)
  }

  return (
    <div className="flow" role="dialog" aria-label="Bunlar ne?">
      <div className="top">
        <button className="icon-btn" onClick={onClose} aria-label="Kapat"><IconX size={20} /></button>
        <div className="progress"><i style={{ width: `${(doneCount / startCount.current) * 100}%` }} /></div>
        <span className="small muted money" style={{ minWidth: 44, textAlign: 'right' }}>{Math.min(doneCount + 1, startCount.current)} / {startCount.current}</span>
      </div>

      <div className="stage">
        {!t ? (
          <div className="done">
            <div className="big">🎉</div>
            <h1 className="title">Hepsi ayrıldı</h1>
            <p className="muted">{skipped.length ? `${skipped.length} tanesini atladın, sonra tekrar sorarım.` : 'Sorulacak hareket kalmadı.'}</p>
            <button className="btn block" style={{ marginTop: 22 }} onClick={onClose}>Özete dön</button>
          </div>
        ) : (
          <div key={t.id} className={`rcard ${leaving === 'l' ? 'out-l' : leaving === 'r' ? 'out-r' : ''}`}>
            <p className="muted small">{dayLabel(t.date)}{t.time ? ` · ${t.time}` : ''} · {t.source === 'kart' ? 'Kart' : 'Hesap'}</p>
            <div className={`amount money ${t.amount > 0 ? 'pos' : ''}`}>{formatTL(t.amount, true)}</div>
            <h3 style={{ wordBreak: 'break-word', fontSize: 17 }}>{displayTitle(t)}</h3>
            {t.counterparty && <p className="muted small" style={{ marginTop: 4, wordBreak: 'break-word' }}>{t.description}</p>}
            <div className="qgrid">
              {choicesFor(t).map(c => <button key={c.label} className="q" onClick={() => apply(c)}>{c.label}</button>)}
            </div>
            <label className="check">
              <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} />
              {t.counterparty ? (t.amount > 0 ? 'Bu kişiden gelenler için hep böyle' : 'Bu kişiye gidenler için hep böyle') : 'Bu işyeri için hep böyle'}
            </label>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn ghost small" onClick={() => setEditing(true)}>Başka…</button>
              <button className="btn ghost small" onClick={() => run('r', async () => setSkipped(s => [...s, t.id]))}>Atla</button>
            </div>
          </div>
        )}
      </div>

      <button className="btn tonal" disabled={!history.current.length} onClick={undo} style={{ alignSelf: 'center' }}>
        <IconUndo size={18} /> Geri al
      </button>
      {editing && t && <TxnEditor txn={t} txns={txns} onClose={() => setEditing(false)} notify={notify} />}
    </div>
  )
}
