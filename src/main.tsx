import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RulesHelp } from './components/RulesHelp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <RulesHelp />
  </StrictMode>,
)
