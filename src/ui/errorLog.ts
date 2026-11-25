export interface LoggedError { at: string; where: string; message: string; stack?: string }

const KEY = 'finans-errors'

export function readErrors(): LoggedError[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function recordError(e: unknown, where: string): void {
  try {
    const err = e instanceof Error ? e : new Error(String(e))
    const entry: LoggedError = { at: new Date().toISOString(), where, message: err.message, stack: err.stack?.slice(0, 1500) }
    localStorage.setItem(KEY, JSON.stringify([entry, ...readErrors()].slice(0, 10)))
  } catch { /* logging must never crash the app */ }
}

export function clearErrors(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export function installGlobalErrorLog(): void {
  window.addEventListener('error', e => recordError(e.error ?? e.message, 'window'))
  window.addEventListener('unhandledrejection', e => recordError(e.reason, 'promise'))
}
