import type { Period } from '../core/periods'
import type { Settings, Subscription, Txn } from '../core/types'
import type { ToastMsg } from './components/Toast'
import type { Tab } from './Nav'

export interface ScreenProps {
  txns: Txn[]
  subs: Subscription[]
  settings: Settings
  period: Period | undefined
  periods: Period[]
  setPeriod: (start: string) => void
  goto: (t: Tab) => void
  notify: (m: ToastMsg) => void
  openReview: () => void
  catFilter: string | undefined
  /** open Hareketler filtered by category (undefined clears the filter) */
  showCategory: (c?: string) => void
}
