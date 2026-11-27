import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { filterTxns, type KindFilter } from '../../core/insights'
import type { Txn } from '../../core/types'
import { PeriodPicker } from '../components/PeriodPicker'
import { TxnEditor } from '../components/TxnEditor'
import { dayLabel, displayTitle, emojiFor, formatTL, rangeLabel } from '../format'
import { IconSearch, IconX } from '../icons'
import type { ScreenProps } from '../shared'

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'hepsi', label: 'Hepsi' }, { id: 'gider', label: 'Gider' }, { id: 'gelir', label: 'Gelir' },
  { id: 'notr', label: 'Sayılmayan' }, { id: 'sor', label: 'Sorulacak' },
]
const SOURCE: Record<Txn['source'], string> = { kart: 'Kart', vadesiz: 'Hesap', vadeli: 'Birikim', elle: 'Elle' }

export function Hareketler({ txns, period, periods, setPeriod, notify, catFilter, showCategory }: ScreenProps) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<KindFilter>('hepsi')
  const [editing, setEditing] = useState<Txn>()

  const { items, total } = useMemo(() => filterTxns(txns, { period, category: catFilter, query: q, kind }), [txns, period, catFilter, q, kind])
  const groups = useMemo(() => {
    const byDay = new Map<string, Txn[]>()
    for (const t of items) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t])
    return [...byDay]
  }, [items])
  const filtered = !!(q || catFilter || kind !== 'hepsi')

  return (
    <>
      <div className="row enter">
        <h1 className="title">Hareketler</h1>
        {period && <PeriodPicker period={period} periods={periods} setPeriod={setPeriod} />}
      </div>
      {period && !q && <p className="muted small" style={{ margin: '-6px 4px 10px' }}>{rangeLabel(period)}</p>}
      <div className="search-wrap enter" style={{ '--i': 1 } as React.CSSProperties}>
        <IconSearch size={18} />
        <input className="search" placeholder="Ara (tüm dönemlerde)…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="chips" data-noswipe>
        {catFilter && (
          <button className="on" onClick={() => showCategory(undefined)} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {emojiFor(catFilter)} {catFilter} <IconX size={14} />
          </button>
        )}
        {FILTERS.map(f => <button key={f.id} className={kind === f.id ? 'on' : ''} onClick={() => setKind(f.id)}>{f.label}</button>)}
      </div>

      {groups.length === 0 && <p className="muted empty">Burada hareket yok.</p>}
      {groups.map(([day, list], gi) => (
        <div key={day} className="enter" style={{ '--i': Math.min(gi, 8) + 2 } as React.CSSProperties}>
          <div className="day">{dayLabel(day)}</div>
          <div className="card" style={{ marginTop: 4, padding: '4px 14px' }}>
            {list.map(t => (
              <button className="list-row" key={t.id} onClick={() => setEditing(t)}>
                <div className="logo">{t.needsReview ? '❓' : emojiFor(t.category)}</div>
                <div className="grow">
                  <div className="ellipsis">{displayTitle(t)}</div>
                  <div className="small muted" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                    <span className="badge">{SOURCE[t.source]}</span>
                    <span className="ellipsis">{t.kind === 'notr' ? `Sayılmaz · ${t.category}` : t.category}{t.note ? ` · ${t.note}` : ''}</span>
                  </div>
                </div>
                <b className={`money ${t.kind === 'notr' ? 'muted' : t.amount > 0 ? 'pos' : ''}`} style={{ whiteSpace: 'nowrap' }}>{formatTL(t.amount, true)}</b>
              </button>
            ))}
          </div>
        </div>
      ))}

      {filtered && items.length > 0 && createPortal(
        <div className="totalbar" key={`${catFilter}-${kind}-${q}`}>
          <span>{items.length} hareket</span>
          <span className="money">Toplam {formatTL(total, true)}</span>
        </div>,
        document.body,
      )}
      {editing && <TxnEditor txn={editing} txns={txns} onClose={() => setEditing(undefined)} notify={notify} />}
    </>
  )
}
