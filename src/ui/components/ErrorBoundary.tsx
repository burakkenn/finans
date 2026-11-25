import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="app empty">
        <div className="big">😵</div>
        <h1 className="title">Bir şeyler ters gitti</h1>
        <p className="muted small">Verilerin silinmedi. Sayfayı yenilemek genelde düzeltir.</p>
        <p className="muted small" style={{ marginTop: 8, wordBreak: 'break-word' }}>{this.state.error.message}</p>
        <button className="btn block" style={{ marginTop: 20 }} onClick={() => location.reload()}>Yenile</button>
      </div>
    )
  }
}
