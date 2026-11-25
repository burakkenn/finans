import { useMemo, useState } from 'react'
import { normTr } from '../../core/text'
import type { Txn } from '../../core/types'
import { MonthPicker } from '../components/MonthPicker'
import { TxnEditor } from '../components/TxnEditor'
import { dayLabel, displayTitle, emojiFor, formatTL } from '../format'
import type { ScreenProps } from '../shared'

type Filter = 'hepsi' | 'gider' | 'gelir' | 'notr' | 'sor'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'hepsi', label: 'Hepsi' }, { id: 'gider', label: 'Gider' }, { id: 'gelir', label: 'Gelir' },
  { id: 'notr', label: 'Sayılmayan' }, { id: 'sor', label: 'Sorulacak' },
]
const SOURCE: Record<Txn['source'], string> = { kart: 'Kart', vadesiz: 'Hesap', vadeli: 'Birikim', elle: 'Elle' }

export function Hareketler({ txns, month, months, setMonth, notify }: ScreenProps) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('hepsi')
  const [editing, setEditing] = useState<Txn>()

  const groups = useMemo(() => {
    const nq = normTr(q)
    const list = txns
      .filter(t => (nq ? true : month ? t.date.startsWith(month) : true))
      .filter(t => !nq || normTr(`${t.description} ${t.counterparty ?? ''} ${t.category} ${t.note ?? ''}`).includes(nq))
      .filter(t => filter === 'hepsi' || (filter === 'sor' ? t.needsReview : t.kind === filter))
      .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')))
    const byDay = new Map<string, Txn[]>()
    for (const t of list) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t])
    return [...byDay]
  }, [txns, month, q, filter])

  return (
    <>
      <div className="row">
        <h1 className="title">Hareketler</h1>
        {month && <MonthPicker month={month} months={months} setMonth={setMonth} />}
      </div>
      <input className="search" placeholder={q ? '' : 'Ara (tüm aylarda)…'} value={q} onChange={e => setQ(e.target.value)} />
      <div className="chips">
        {FILTERS.map(f => <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>)}
      </div>

      {groups.length === 0 && <p className="muted empty">Burada hareket yok.</p>}
      {groups.map(([day, list]) => (
        <div key={day}>
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
      {editing && <TxnEditor txn={editing} txns={txns} onClose={() => setEditing(undefined)} notify={notify} />}
    </>
  )
}
