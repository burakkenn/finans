import { useMemo, useState } from 'react'
import { monthSummary } from '../../core/summary'
import { subscriptionView } from '../../core/subscriptions'
import { MonthPicker } from '../components/MonthPicker'
import { emojiFor, formatTL, shortDate } from '../format'
import type { ScreenProps } from '../shared'

const BAR_COLORS = ['#FF8A65', '#4DB6AC', '#7986CB', '#FFB74D', '#BA68C8', '#4FC3F7', '#AED581', '#F06292', '#90A4AE', '#A1887F']

export function Ozet({ txns, subs, settings, month, months, setMonth, goto }: ScreenProps) {
  const [showPeople, setShowPeople] = useState(false)
  const s = useMemo(() => (month ? monthSummary(txns, month) : undefined), [txns, month])
  const subRows = useMemo(() => (month ? subscriptionView(txns, subs, month) : []), [txns, subs, month])

  if (!month || !s) {
    return (
      <div className="empty">
        <div className="big">📄</div>
        <h1 className="title">Hoş geldin</h1>
        <p className="muted">Başlamak için İşCep'ten indirdiğin kart ekstresini (PDF) ve hesap hareketlerini (Excel) yükle.</p>
        <button className="btn block" style={{ marginTop: 20 }} onClick={() => goto('ayarlar')}>📥 Dosya yükle</button>
      </div>
    )
  }

  const activeSubs = subRows.filter(r => !r.cancelled && r.monthTotal > 0)
  const subTotal = activeSubs.reduce((a, r) => a + r.monthTotal, 0)
  const maxCat = Math.max(...s.byCategory.map(c => c.amount), 1)
  const firstName = settings.ownerName.split(' ')[0]

  return (
    <>
      <div className="row">
        <span className="muted small">{firstName ? `Merhaba ${firstName}` : 'Merhaba'}</span>
        <MonthPicker month={month} months={months} setMonth={setMonth} />
      </div>

      <div className="hero">
        <div className="k">Bu ay elinde kalan</div>
        <div className="v money">{formatTL(s.kalan, true)}</div>
        <div className="row">
          <div className="pill"><div className="k">Gelir</div><div className="v money pos">{formatTL(s.gelir)}</div></div>
          <div className="pill"><div className="k">Gider</div><div className="v money neg">{formatTL(s.gider)}</div></div>
        </div>
      </div>

      {s.reviewCount > 0 && (
        <button className="banner" onClick={() => goto('ayarlar')}>
          <span style={{ fontSize: 20 }}>🧐</span>
          <span className="grow">{s.reviewCount} hareket ne olduğunu soruyor</span>
          <span>›</span>
        </button>
      )}

      {s.byCategory.length > 0 && (
        <div className="card">
          <h3>Para nereye gitti</h3>
          {s.byCategory.map((c, i) => (
            <div className="cat" key={c.category}>
              <div className="row"><span>{emojiFor(c.category)} {c.category}</span><b className="money">{formatTL(c.amount)}</b></div>
              <div className="bar"><i style={{ width: `${Math.max(0, (c.amount / maxCat) * 100)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} /></div>
            </div>
          ))}
        </div>
      )}

      {activeSubs.length > 0 && (
        <div className="card">
          <div className="row" style={{ marginBottom: 8 }}>
            <h3>Abonelikler</h3>
            <span className="chip">aylık ~{formatTL(subTotal)}</span>
          </div>
          {activeSubs.slice(0, 3).map(r => (
            <button className="list-row" key={r.key} onClick={() => goto('abonelikler')}>
              <div className="logo">{r.name[0]}</div>
              <span className="grow">{r.name}{r.payments.length > 1 ? ` (${r.payments.length} ödeme)` : ''}</span>
              <b className="money">{formatTL(r.monthTotal)}</b>
            </button>
          ))}
          {activeSubs.length > 3 && (
            <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => goto('abonelikler')}>Tümünü gör</button>
          )}
        </div>
      )}

      {(s.faiz.brut !== 0 || s.faiz.stopaj !== 0) && (
        <div className="card">
          <div className="row">
            <h3>💰 Net faiz</h3>
            <b className="money pos" style={{ fontSize: 20 }}>{formatTL(s.faiz.net, true)}</b>
          </div>
          <div className="row small muted" style={{ marginTop: 6 }}>
            <span>Brüt {formatTL(s.faiz.brut)}</span>
            <span>Vergi kesintisi {formatTL(s.faiz.stopaj)}</span>
          </div>
        </div>
      )}

      {s.kisiler.length > 0 && (
        <div className="card">
          <button className="row" style={{ width: '100%' }} onClick={() => setShowPeople(v => !v)}>
            <h3>👥 Kişilerle transferler</h3>
            <span className="muted small">{s.kisiler.length} hareket {showPeople ? '▴' : '▾'}</span>
          </button>
          <p className="muted small" style={{ marginTop: 4 }}>Gelire ya da gidere sayılmaz.</p>
          {showPeople && s.kisiler.map(t => (
            <div className="list-row" key={t.id}>
              <span className="grow ellipsis">{t.counterparty ?? t.description}</span>
              <span className="muted small">{shortDate(t.date)}</span>
              <b className={`money ${t.amount > 0 ? 'pos' : ''}`}>{formatTL(t.amount, true)}</b>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
