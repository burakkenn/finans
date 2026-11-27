import { useMemo, useState } from 'react'
import { periodInsights } from '../../core/insights'
import { subscriptionView } from '../../core/subscriptions'
import { periodSummary } from '../../core/summary'
import { saveSettings } from '../../db/db'
import { reclassifyAll } from '../../db/importFile'
import { PeriodPicker } from '../components/PeriodPicker'
import { emojiFor, formatTL, rangeLabel, shortDate } from '../format'
import { todayIso, useCountUp } from '../hooks'
import { IconChevR, IconSparkle, IconUpload } from '../icons'
import type { ScreenProps } from '../shared'
import { useUploader } from '../useUploader'

const BAR_COLORS = ['#FF8A65', '#4DB6AC', '#7986CB', '#FFB74D', '#BA68C8', '#4FC3F7', '#AED581', '#F06292', '#90A4AE', '#A1887F']

function Money({ value, sign, className }: { value: number; sign?: boolean; className?: string }) {
  return <span className={`money ${className ?? ''}`}>{formatTL(useCountUp(value), sign)}</span>
}

function Onboarding({ settings, txns, notify, openReview }: Pick<ScreenProps, 'settings' | 'txns' | 'notify' | 'openReview'>) {
  const [name, setName] = useState(settings.ownerName)
  const up = useUploader(notify)
  const step = !settings.ownerName ? 1 : !txns.length ? 2 : 3
  const reviewCount = txns.filter(t => t.needsReview).length
  return (
    <div style={{ paddingTop: 20 }}>
      <div className="empty enter" style={{ padding: '10px 0 8px' }}>
        <div className="big">👋</div>
        <h1 className="title">Hoş geldin</h1>
        <p className="muted">Üç adımda hazırız. Her şey sadece bu telefonda kalır.</p>
      </div>
      <div className={`card enter step ${step === 1 ? 'active' : 'done'}`} style={{ '--i': 1 } as React.CSSProperties}>
        <div className="num">{step > 1 ? '✓' : 1}</div>
        <div className="grow">
          <h3>Adın soyadın</h3>
          {step === 1 ? (
            <>
              <p className="muted small" style={{ marginTop: 4 }}>Kendi hesapların arasındaki transferleri tanımak için. Bankada yazdığı gibi yaz.</p>
              <input className="search" style={{ marginTop: 10, paddingLeft: 14 }} value={name} onChange={e => setName(e.target.value)} placeholder="Ad Soyad" />
              <button className="btn block" style={{ marginTop: 10 }} disabled={!name.trim()}
                onClick={async () => { await saveSettings({ ...settings, ownerName: name.trim() }); await reclassifyAll() }}>Devam</button>
            </>
          ) : <p className="muted small">{settings.ownerName}</p>}
        </div>
      </div>
      <div className={`card enter step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`} style={{ '--i': 2 } as React.CSSProperties}>
        <div className="num">{step > 2 ? '✓' : 2}</div>
        <div className="grow">
          <h3>Ekstrelerini yükle</h3>
          <p className="muted small" style={{ marginTop: 4 }}>İşCep'ten kart ekstresi (PDF) ve hesap hareketleri (Excel). Hepsini birden seçebilirsin.</p>
          {step === 2 && (
            <button className="btn block" style={{ marginTop: 10 }} disabled={up.busy} onClick={up.pick}>
              <IconUpload size={18} /> {up.busy ? 'Okunuyor…' : 'Dosya seç'}
            </button>
          )}
          {up.input}
        </div>
      </div>
      <div className={`card enter step ${step === 3 ? 'active' : ''}`} style={{ '--i': 3 } as React.CSSProperties}>
        <div className="num">3</div>
        <div className="grow">
          <h3>Ne olduklarını söyle</h3>
          <p className="muted small" style={{ marginTop: 4 }}>Tanıyamadığım hareketleri tek tek sorarım, bir kere söylemen yeter.</p>
          {step === 3 && reviewCount > 0 && (
            <button className="btn block" style={{ marginTop: 10 }} onClick={openReview}><IconSparkle size={18} /> {reviewCount} hareketi ayır</button>
          )}
        </div>
      </div>
    </div>
  )
}

export function Ozet(props: ScreenProps) {
  const { txns, subs, settings, period, periods, setPeriod, goto, openReview, showCategory } = props
  const [showPeople, setShowPeople] = useState(false)
  const today = todayIso()
  const s = useMemo(() => (period ? periodSummary(txns, period) : undefined), [txns, period])
  const ins = useMemo(() => (period ? periodInsights(txns, period, periods, today) : undefined), [txns, period, periods, today])
  const subRows = useMemo(() => (period ? subscriptionView(txns, subs, period) : []), [txns, subs, period])

  if (!period || !s || !ins || !settings.ownerName) return <Onboarding {...props} />

  const activeSubs = subRows.filter(r => !r.cancelled && r.monthTotal > 0)
  const subTotal = activeSubs.reduce((a, r) => a + r.monthTotal, 0)
  const maxCat = Math.max(...s.byCategory.map(c => c.amount), 1)
  const maxIn = Math.max(...s.gelirByCategory.map(c => c.amount), 1)
  const firstName = settings.ownerName.split(' ')[0]
  const spentPct = s.gelir > 0 ? Math.round((s.gider / s.gelir) * 100) : undefined
  const barColor = spentPct === undefined ? '#8A90A2' : spentPct < 80 ? '#2E9D63' : spentPct < 100 ? '#F2A33A' : '#D9534F'
  const lastCard = txns.filter(t => t.source === 'kart').reduce((m, t) => (t.date > m ? t.date : m), '')
  const cardBehind = lastCard && lastCard < (period.end ?? today) ? lastCard : ''
  let i = 0
  const nx = () => ({ '--i': i++ } as React.CSSProperties)

  return (
    <>
      <div className="row enter" style={nx()}>
        <span className="muted small">Merhaba {firstName}</span>
        <PeriodPicker period={period} periods={periods} setPeriod={setPeriod} />
      </div>

      <div className="hero enter" style={nx()} key={period.start}>
        <div className="row"><span className="k">Bu dönem elinde kalan</span><span className="k" style={{ fontWeight: 500 }}>{rangeLabel(period)}</span></div>
        <div className="v"><Money value={s.kalan} sign /></div>
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="pill">
            <div className="k">Gelir</div>
            <div className="v"><Money value={s.gelir} className="pos" /></div>
            {s.faiz.net !== 0 && <div className="k money" style={{ marginTop: 4, fontSize: 11.5, whiteSpace: 'nowrap' }}>💰 {formatTL(s.faiz.net, true)} faiz dahil</div>}
          </div>
          <div className="pill">
            <div className="k">Gider</div>
            <div className="v"><Money value={s.gider} className="neg" /></div>
          </div>
        </div>
        {spentPct !== undefined && (
          <div style={{ marginTop: 14 }}>
            <div className="bar" style={{ background: 'rgba(127,140,170,.22)', height: 10 }}>
              <i style={{ width: `${Math.min(100, Math.max(0, spentPct))}%`, background: barColor }} />
            </div>
            <div className="k" style={{ marginTop: 6, fontWeight: 500 }}>Gelirin %{spentPct} kadarı harcandı</div>
          </div>
        )}
        <div className="insight">
          {!cardBehind && <span>Günde ~{formatTL(ins.dailyAvg)}</span>}
          {!cardBehind && ins.changePct !== undefined && (
            <span>{ins.changePct <= 0 ? '📉' : '📈'} Geçen döneme göre %{Math.abs(ins.changePct)} {ins.changePct <= 0 ? 'daha az' : 'daha fazla'}</span>
          )}
          {ins.daysLeft !== undefined && <span>⏳ Sonraki harçlığa ~{ins.daysLeft} gün</span>}
          {!period.end ? null : <span>{ins.days} gün sürdü</span>}
        </div>
        {cardBehind && <div className="k" style={{ marginTop: 10, fontWeight: 500 }}>💳 Kart harcamaları {shortDate(cardBehind)} tarihine kadar yüklü</div>}
      </div>

      {s.reviewCount > 0 && (
        <button className="banner enter press" style={nx()} onClick={openReview}>
          <span style={{ fontSize: 20 }}>🧐</span>
          <span className="grow">{s.reviewCount} hareket ne olduğunu soruyor</span>
          <IconChevR size={18} />
        </button>
      )}

      {s.gelirByCategory.length > 0 && (
        <div className="card enter" style={nx()}>
          <h3>Para nereden geldi</h3>
          {s.gelirByCategory.map((c, k) => (
            <button className="cat-btn" key={c.category} onClick={() => showCategory(c.category)}>
              <div className="row" style={{ fontSize: 14, marginBottom: 6 }}>
                <span>{emojiFor(c.category)} {c.category}</span>
                <span className="row" style={{ gap: 4 }}><b className="money pos">{formatTL(c.amount)}</b><IconChevR size={14} className="chev" /></span>
              </div>
              <div className="bar"><i style={{ width: `${Math.max(0, (c.amount / maxIn) * 100)}%`, background: '#43A872', '--i': k } as React.CSSProperties} /></div>
            </button>
          ))}
        </div>
      )}

      {s.byCategory.length > 0 && (
        <div className="card enter" style={nx()}>
          <h3>Para nereye gitti</h3>
          {s.byCategory.map((c, k) => (
            <button className="cat-btn" key={c.category} onClick={() => showCategory(c.category)}>
              <div className="row" style={{ fontSize: 14, marginBottom: 6 }}>
                <span>{emojiFor(c.category)} {c.category}</span>
                <span className="row" style={{ gap: 4 }}><b className="money">{formatTL(c.amount)}</b><IconChevR size={14} className="chev" /></span>
              </div>
              <div className="bar"><i style={{ width: `${Math.max(0, (c.amount / maxCat) * 100)}%`, background: BAR_COLORS[k % BAR_COLORS.length], '--i': k } as React.CSSProperties} /></div>
            </button>
          ))}
        </div>
      )}

      {activeSubs.length > 0 && (
        <div className="card enter" style={nx()}>
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
          {activeSubs.length > 3 && <button className="btn ghost small" style={{ marginTop: 8 }} onClick={() => goto('abonelikler')}>Tümünü gör</button>}
        </div>
      )}

      {(s.faiz.brut !== 0 || s.faiz.stopaj !== 0) && (
        <div className="card enter" style={nx()}>
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
        <div className="card enter" style={nx()}>
          <button className="row" style={{ width: '100%' }} onClick={() => setShowPeople(v => !v)}>
            <h3>👥 Kişilerle transferler</h3>
            <span className="muted small">{s.kisiler.length} hareket {showPeople ? '▴' : '▾'}</span>
          </button>
          <p className="muted small" style={{ marginTop: 4 }}>Gelire ya da gidere sayılmaz.</p>
          {showPeople && s.kisiler.map(t => (
            <div className="list-row enter" key={t.id}>
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
