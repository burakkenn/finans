import { useEffect } from 'react'

export type ToastMsg = { text: string; error?: boolean }

export function Toast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, msg.error ? 5000 : 3000)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg])
  return <div className={`toast ${msg.error ? 'err' : ''}`} role="status">{msg.text}</div>
}
