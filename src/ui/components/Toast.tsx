import { useEffect } from 'react'

export type ToastMsg = { text: string; error?: boolean; action?: { label: string; run: () => void } }

export function Toast({ msg, onDone }: { msg: ToastMsg; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, msg.error ? 5000 : msg.action ? 5000 : 2800)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg])
  return (
    <div className={`toast ${msg.error ? 'err' : ''}`} role="status">
      <span>{msg.text}</span>
      {msg.action && <button onClick={() => { msg.action!.run(); onDone() }}>{msg.action.label}</button>}
    </div>
  )
}
