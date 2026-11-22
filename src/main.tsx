import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RulesHelp } from './components/RulesHelp'

const PixiPreview = lazy(async () => {
  const module = await import('./pixi/PixiPreview')
  return { default: module.PixiPreview }
})

const preview = new URLSearchParams(window.location.search).has('pixi-preview')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {preview ? (
      <Suspense fallback={<p>Loading PixiJS preview…</p>}>
        <PixiPreview />
      </Suspense>
    ) : (
      <>
        <App />
        <RulesHelp />
      </>
    )}
  </StrictMode>,
)
