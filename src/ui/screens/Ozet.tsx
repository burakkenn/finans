import { useMemo, useState } from 'react'
import { periodSummary } from '../../core/summary'
import { subscriptionView } from '../../core/subscriptions'
import { PeriodPicker } from '../components/PeriodPicker'
import { emojiFor, formatTL, rangeLabel, shortDate } from '../format'
import type { ScreenProps } from '../shared'

const BAR_COLORS = ['#FF8A65', '#4DB6AC', '#7986CB', '#FFB74D', '#BA68C8', '#4FC3F7', '#AED581', '#F06292', '#90A4AE', '#A1887F']

export function Ozet({ txns, subs, settings, period, periods, setPeriod, goto }: ScreenProps) {
  const [showPeople, setShowPeople] = useState(false)
  const s = useMemo(() => (period ? periodSummary(txns, period) : undefined), [txns, period])
  const subRows = useMemo(() => (period ? subscriptionView(txns, subs, period) : []), [txns, subs, period])

  if (!period || !s) {
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
  const spentPct = s.gelir > 0 ? Math.round((s.gider / s.gelir) * 100) : undefined
  const barColor = spentPct === undefined ? '#8A90A2' : spentPct < 80 ? '#2E9D63' : spentPct < 100 ? '#F2A33A' : '#D9534F'
  const lastCard = txns.filter(t => t.source === 'kart').reduce((m, t) => (t.date > m ? t.date : m), '')
  const periodEnd = period.end ?? new Date().toISOString().slice(0, 10)
  const cardBehind = lastCard && lastCard < periodEnd ? lastCard : ''

  return (
    <>
      <div className="row">
        <span className="muted small">{firstName ? `Merhaba ${firstName}` : 'Merhaba'}</span>
        <PeriodPicker period={period} periods={periods} setPeriod={setPeriod} />
      </div>

      <div className="hero">
        <div className="row"><span className="k">Bu dönem elinde kalan</span><span className="k" style={{ fontWeight: 500 }}>{rangeLabel(period)}</span></div>
        <div className="v money">{formatTL(s.kalan, true)}</div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="pill">
            <div className="k">Gelir</div>
            <div className="v money pos">{formatTL(s.gelir)}</div>
            {s.faiz.net !== 0 && <div className="k money" style={{ marginTop: 4, fontSize: 11.5, whiteSpace: 'nowrap' }}>💰 {formatTL(s.faiz.net, true)} faiz dahil</div>}
          </div>
          <div className="pill"><div className="k">Gider</div><div className="v money neg">{formatTL(s.gider)}</div></div>
        </div>
        {spentPct !== undefined && (
          <div style={{ marginTop: 14 }}>
            <div className="bar" style={{ background: 'rgba(27,46,94,.12)', height: 10 }}>
              <i style={{ width: `${Math.min(100, Math.max(0, spentPct))}%`, background: barColor }} />
            </div>
            <div className="k" style={{ marginTop: 6, fontWeight: 500 }}>Gelirin %{spentPct} kadarı harcandı</div>
          </div>
        )}
        {cardBehind && (
          <div className="k" style={{ marginTop: 8, fontWeight: 500 }}>💳 Kart harcamaları {shortDate(cardBehind)} tarihine kadar yüklü</div>
        )}
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
            <span className="chip">bu dönem {formatTL(subTotal)}</span>
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
