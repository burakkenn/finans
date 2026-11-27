import { useRef, useState } from 'react'
import { importFile } from '../db/importFile'
import type { ToastMsg } from './components/Toast'
import { haptic } from './hooks'

export interface UploadResult { added: number; skipped: number; review: number; files: number; errors: string[] }

/** One hidden file input + upload state, shared by onboarding and Ayarlar. */
export function useUploader(notify: (m: ToastMsg) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<UploadResult>()

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    const r: UploadResult = { added: 0, skipped: 0, review: 0, files: files.length, errors: [] }
    for (const f of Array.from(files)) {
      try {
        const x = await importFile(f)
        r.added += x.added; r.skipped += x.skipped; r.review += x.review
      } catch (e) {
        r.errors.push(`${f.name}: ${(e as Error).message}`)
      }
    }
    setBusy(false)
    if (ref.current) ref.current.value = ''
    setResult(r)
    haptic(20)
    if (r.errors.length) notify({ text: r.errors.join(' · '), error: true })
  }

  const input = (
    <input ref={ref} type="file" accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel" multiple hidden
      onChange={e => onFiles(e.target.files)} />
  )
  return { input, busy, result, clearResult: () => setResult(undefined), pick: () => ref.current?.click() }
}
