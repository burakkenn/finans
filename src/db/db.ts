import Dexie, { type EntityTable } from 'dexie'
import type { Rule, Settings, Subscription, Txn } from '../core/types'

interface SettingRow { k: string; v: unknown }

export class FinansDB extends Dexie {
  txns!: EntityTable<Txn, 'id'>
  rules!: EntityTable<Rule, 'id'>
  subs!: EntityTable<Subscription, 'key'>
  settings!: EntityTable<SettingRow, 'k'>
  constructor() {
    super('finans')
    this.version(1).stores({
      txns: '&id, date, kind, category, needsReview, source',
      rules: '&id',
      subs: '&key',
      settings: '&k',
    })
  }
}

export const db = new FinansDB()

const DEFAULT_SETTINGS: Settings = { ownerName: '', neutralPeople: [] }

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings')
  return { ...DEFAULT_SETTINGS, ...(row?.v as Partial<Settings> | undefined) }
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put({ k: 'settings', v: s })
}
