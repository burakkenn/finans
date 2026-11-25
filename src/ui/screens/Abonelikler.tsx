import { useMemo, useState } from 'react'
import { subscriptionView, type SubscriptionRow } from '../../core/subscriptions'
import type { Subscription } from '../../core/types'
import { db } from '../../db/db'
import { PeriodPicker } from '../components/PeriodPicker'
import { Sheet } from '../components/TxnEditor'
import { formatTL, rangeLabel, shortDate } from '../format'
import type { ScreenProps } from '../shared'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function saveSub(subs: Subscription[], row: SubscriptionRow, patch: Partial<Subscription>) {
  const cur = subs.find(s => s.key === row.key) ?? { key: row.key, name: row.name, cancelled: false, paymentLabels: {} }
  await db.subs.put({ ...cur, ...patch })
}

export function Abonelikler({ txns, subs, period, periods, setPeriod, notify }: ScreenProps) {
  const rows = useMemo(() => (period ? subscriptionView(txns, subs, period) : []), [txns, subs, period])
  const [open, setOpen] = useState<string>()
  const [labeling, setLabeling] = useState<{ row: SubscriptionRow; amount: number; label: string }>()

  if (!period) return <><h1 className="title">Abonelikler</h1><p className="muted empty">Önce bir ekstre yükle.</p></>

  const active = rows.filter(r => !r.cancelled && r.monthTotal > 0)
  const quiet = rows.filter(r => !r.cancelled && r.monthTotal === 0)
  const cancelled = rows.filter(r => r.cancelled)
  const total = active.reduce((a, r) => a + r.monthTotal, 0)

  const Row = ({ r }: { r: SubscriptionRow }) => {
    const isOpen = open === r.key
    return (
      <div style={{ borderTop: '1px solid #F0F1F5' }}>
        <button className="list-row" style={{ borderTop: 0 }} onClick={() => setOpen(isOpen ? undefined : r.key)}>
          <div className="logo" style={r.cancelled ? { opacity: .5 } : undefined}>{r.name[0]}</div>
          <div className="grow">
            <div style={r.cancelled ? { textDecoration: 'line-through', color: '#8A90A2' } : undefined}>{r.name}</div>
            <div className="small muted">{r.payments.length ? `${r.payments.length} ödeme bu dönem` : 'Bu dönem ödeme yok'}</div>
          </div>
          <b className="money">{formatTL(r.monthTotal)}</b>
          <span className="muted">{isOpen ? '▴' : '▾'}</span>
        </button>
        {r.chargedAfterCancel && (
          <div className="banner" style={{ marginTop: 0, marginBottom: 8 }}>⚠️ İptal ettiğin {r.name} aboneliğinden yine ödeme çekilmiş!</div>
        )}
        {isOpen && (
          <div style={{ padding: '0 4px 12px 46px' }}>
            {r.payments.map(p => (
              <button key={p.id} className="row small" style={{ width: '100%', padding: '7px 0' }}
                onClick={() => setLabeling({ row: r, amount: p.amount, label: p.label ?? '' })}>
                <span className="muted" style={{ width: 52, textAlign: 'left' }}>{shortDate(p.date)}</span>
                <span className="grow" style={{ textAlign: 'left' }}>{p.label ?? <span className="muted">isim ver ✎</span>}</span>
                <b className="money">{formatTL(p.amount)}</b>
              </button>
            ))}
            <div className="row" style={{ marginTop: 8, justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {r.cancelled
                ? <button className="btn tonal small" onClick={() => saveSub(subs, r, { cancelled: false, cancelledAt: undefined })}>Geri al</button>
                : <button className="btn danger small" onClick={async () => { await saveSub(subs, r, { cancelled: true, cancelledAt: today() }); notify({ text: `${r.name} iptal edildi olarak işaretlendi` }) }}>İptal ettim</button>}
              <button className="btn ghost small" onClick={async () => { await saveSub(subs, r, { excluded: true }); notify({ text: `${r.name} abonelik listesinden çıkarıldı` }) }}>Bu bir abonelik değil</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="row">
        <h1 className="title">Abonelikler</h1>
        <PeriodPicker period={period} periods={periods} setPeriod={setPeriod} />
      </div>
      <div className="hero" style={{ marginTop: 0 }}>
        <div className="row"><span className="k">Bu dönem aboneliklere giden</span><span className="k" style={{ fontWeight: 500 }}>{rangeLabel(period)}</span></div>
        <div className="v money" style={{ marginBottom: 0 }}>{formatTL(total)}</div>
      </div>

      {active.length > 0 && <div className="card"><h3>Aktif</h3>{active.map(r => <Row key={r.key} r={r} />)}</div>}
      {quiet.length > 0 && <div className="card"><h3>Bu dönem çekim olmayanlar</h3>{quiet.map(r => <Row key={r.key} r={r} />)}</div>}
      {cancelled.length > 0 && <div className="card"><h3 className="muted">İptal edilenler</h3>{cancelled.map(r => <Row key={r.key} r={r} />)}</div>}
      {rows.length === 0 && <p className="muted empty">Henüz abonelik bulunamadı.</p>}
      <p className="muted small" style={{ padding: '12px 4px' }}>
        Apple gibi yerlerde ekstre hangi uygulama olduğunu yazmıyor. Bir ödemeye dokunup isim verirsen, aynı tutar sonraki aylarda gelince o ismi kullanırım.
      </p>

      {labeling && (
        <Sheet onClose={() => setLabeling(undefined)}>
          <h3>{labeling.row.name} · {formatTL(labeling.amount)}</h3>
          <label className="field">Bu ödeme ne?
            <input autoFocus value={labeling.label} placeholder="ör. iCloud" onChange={e => setLabeling({ ...labeling, label: e.target.value })} />
          </label>
          <button className="btn block" style={{ marginTop: 16 }} onClick={async () => {
            const cur = subs.find(s => s.key === labeling.row.key)
            const labels = { ...(cur?.paymentLabels ?? {}) }
            const k = labeling.amount.toFixed(2)
            if (labeling.label.trim()) labels[k] = labeling.label.trim(); else delete labels[k]
            await saveSub(subs, labeling.row, { paymentLabels: labels })
            setLabeling(undefined)
          }}>Kaydet</button>
        </Sheet>
      )}
    </>
  )
}
