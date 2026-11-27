import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { computePeriods } from '../core/periods'
import { db, getSettings } from '../db/db'
import { ReviewFlow } from './components/ReviewFlow'
import { Toast, type ToastMsg } from './components/Toast'
import { haptic, todayIso, useSwipe } from './hooks'
import { Nav, TAB_ORDER, type Tab } from './Nav'
import { Abonelikler } from './screens/Abonelikler'
import { Ayarlar } from './screens/Ayarlar'
import { Hareketler } from './screens/Hareketler'
import { Ozet } from './screens/Ozet'

export function App() {
  const [tab, setTabRaw] = useState<Tab>('ozet')
  const [dir, setDir] = useState<'from-right' | 'from-left' | ''>('')
  const txns = useLiveQuery(() => db.txns.toArray(), [])
  const subs = useLiveQuery(() => db.subs.toArray(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const periods = useMemo(() => computePeriods(txns ?? [], todayIso()), [txns])
  const [periodStart, setPeriodStart] = useState<string>()
  const period = periods.find(p => p.start === periodStart) ?? periods[0]
  const [toast, setToast] = useState<ToastMsg>()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [catFilter, setCatFilter] = useState<string>()

  function setTab(next: Tab) {
    if (next === tab) return
    setDir(TAB_ORDER.indexOf(next) > TAB_ORDER.indexOf(tab) ? 'from-right' : 'from-left')
    setTabRaw(next)
    haptic(8)
  }
  const swipeRef = useSwipe(d => {
    const i = TAB_ORDER.indexOf(tab) + d
    if (i >= 0 && i < TAB_ORDER.length) setTab(TAB_ORDER[i])
  }, reviewOpen)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])

  if (!txns || !subs || !settings) return <div className="app" />

  const shared = {
    txns, subs, settings, period, periods, setPeriod: setPeriodStart, notify: setToast,
    goto: setTab, openReview: () => setReviewOpen(true),
    catFilter, showCategory: (c?: string) => { setCatFilter(c); if (c) setTab('hareketler') },
  }
  return (
    <>
      <div className="app" ref={swipeRef}>
        <div key={tab} className={`page ${dir}`}>
          {tab === 'ozet' && <Ozet {...shared} />}
          {tab === 'hareketler' && <Hareketler {...shared} />}
          {tab === 'abonelikler' && <Abonelikler {...shared} />}
          {tab === 'ayarlar' && <Ayarlar {...shared} />}
        </div>
      </div>
      <Nav tab={tab} onChange={setTab} />
      {reviewOpen && <ReviewFlow txns={txns} onClose={() => setReviewOpen(false)} notify={setToast} />}
      {toast && <Toast msg={toast} onDone={() => setToast(undefined)} />}
    </>
  )
}
