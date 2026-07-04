import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'
import './index.css'
import './ui/cards.css'
import App from './App'
import { useStore } from './store/useStore'

if (import.meta.env.DEV) {
  ;(window as unknown as { useStore: typeof useStore }).useStore = useStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
