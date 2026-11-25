import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { App } from './ui/App'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { installGlobalErrorLog } from './ui/errorLog'

installGlobalErrorLog()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
