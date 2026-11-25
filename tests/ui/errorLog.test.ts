import { beforeEach, describe, expect, it } from 'vitest'
import { clearErrors, readErrors, recordError } from '../../src/ui/errorLog'

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
  }
})

describe('errorLog', () => {
  it('keeps the newest 10 errors with message and where', () => {
    for (let i = 0; i < 12; i++) recordError(new Error(`e${i}`), 'render')
    const list = readErrors()
    expect(list.length).toBe(10)
    expect(list[0].message).toBe('e11')
    expect(list[0].where).toBe('render')
  })
  it('clears', () => {
    recordError('x', 'window')
    clearErrors()
    expect(readErrors()).toEqual([])
  })
})
