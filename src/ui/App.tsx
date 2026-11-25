import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { monthsWithData } from '../core/summary'
import { db, getSettings } from '../db/db'
import { Nav, type Tab } from './Nav'
import { Abonelikler } from './screens/Abonelikler'
import { Ayarlar } from './screens/Ayarlar'
import { Hareketler } from './screens/Hareketler'
import { Ozet } from './screens/Ozet'
import { Toast, type ToastMsg } from './components/Toast'

export function App() {
  const [tab, setTab] = useState<Tab>('ozet')
  const txns = useLiveQuery(() => db.txns.toArray(), [])
  const subs = useLiveQuery(() => db.subs.toArray(), [])
  const settings = useLiveQuery(() => getSettings(), [])
  const months = useMemo(() => monthsWithData(txns ?? []), [txns])
  const [month, setMonth] = useState<string>()
  const [toast, setToast] = useState<ToastMsg>()

  useEffect(() => {
    if (!month || !months.includes(month)) setMonth(months[0])
  }, [months, month])

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  if (!txns || !subs || !settings) return <div className="app" />

  const shared = { txns, subs, settings, month, months, setMonth, goto: setTab, notify: setToast }
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
