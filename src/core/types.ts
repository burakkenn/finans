export type Source = 'kart' | 'vadesiz' | 'vadeli' | 'elle'
export type Kind = 'gelir' | 'gider' | 'notr'

export interface RawTxn {
  id: string
  source: Source
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  time?: string
  description: string
  /** > 0 para girişi, < 0 para çıkışı */
  amount: number
  /** Bankanın "İşlem Tipi" sütunu */
  bankType?: string
  counterparty?: string
}

export interface Txn extends RawTxn {
  kind: Kind
  category: string
  needsReview: boolean
  userEdited: boolean
  note?: string
  /** true = always starts a period, false = never (overrides the automatic choice) */
  periodStart?: boolean
}

export interface Rule {
  id: string
  field: 'description' | 'counterparty'
  /** normTr ile normalize edilmiş alt metin */
  match: string
  kind: Kind
  category: string
  /** only money received (in) or sent (out); undefined = both */
  direction?: 'in' | 'out'
}

export interface Subscription {
  key: string
  name: string
  cancelled: boolean
  cancelledAt?: string
  /** "Bu bir abonelik değil" */
  excluded?: boolean
  /** amount.toFixed(2) → etiket */
  paymentLabels: Record<string, string>
}

export interface Settings {
  ownerName: string
  /** normTr ile normalize edilmiş isimler */
  neutralPeople: string[]
}
