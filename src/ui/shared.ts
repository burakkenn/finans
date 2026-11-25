import type { Settings, Subscription, Txn } from '../core/types'
import type { ToastMsg } from './components/Toast'
import type { Tab } from './Nav'

export interface ScreenProps {
  txns: Txn[]
  subs: Subscription[]
  settings: Settings
  month: string | undefined
  months: string[]
  setMonth: (m: string) => void
  goto: (t: Tab) => void
  notify: (m: ToastMsg) => void
}
