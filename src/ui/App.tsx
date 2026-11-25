import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { computePeriods } from '../core/periods'
import { db, getSettings } from '../db/db'
import { Nav, type Tab } from './Nav'
import { Abonelikler } from './screens/Abonelikler'
import { Ayarlar } from './screens/Ayarlar'
import { Hareketler } from './screens/Hareketler'
import { Ozet } from './screens/Ozet'
import { Toast, type ToastMsg } from './components/Toast'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function App() {
  const [tab, setTab] = useState<Tab>('ozet')
  const txns = useLiveQuery(() => db.txns.toArray(), [])
  const subs = useLiveQuery(() => db.subs.toArray(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const periods = useMemo(() => computePeriods(txns ?? [], todayIso()), [txns])
  const [periodStart, setPeriodStart] = useState<string>()
  const period = periods.find(p => p.start === periodStart) ?? periods[0]
  const [toast, setToast] = useState<ToastMsg>()

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  if (!txns || !subs || !settings) return <div className="app" />

  const shared = { txns, subs, settings, period, periods, setPeriod: setPeriodStart, goto: setTab, notify: setToast }
  return (
    <>
      <div className="app">
        {tab === 'ozet' && <Ozet {...shared} />}
        {tab === 'hareketler' && <Hareketler {...shared} />}
        {tab === 'abonelikler' && <Abonelikler {...shared} />}
        {tab === 'ayarlar' && <Ayarlar {...shared} />}
      </div>
      <Nav tab={tab} onChange={setTab} />
      {toast && <Toast msg={toast} onDone={() => setToast(undefined)} />}
    </>
  )
}
