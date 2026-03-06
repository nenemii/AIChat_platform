import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'antd/dist/reset.css'
import './index.css'
import App from './App.tsx'
import '../src/components/Theme.module.css'
import { Profiler } from 'react'

createRoot(document.getElementById('root')!).render(
  <Profiler id = 'app' onRender={(id, phase, actualDuration, baseDuration, startTime, commitTime, interactions)=>{}}>
    <StrictMode>
    <App />
  </StrictMode>,
  </Profiler>

)
