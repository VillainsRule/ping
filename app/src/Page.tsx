import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'

import StatusPage from './components/StatusPage'

import type { PageStatusResponse } from './types'

import { TooltipProvider } from '@/components/ui/tooltip'

import './index.css'

declare global {
    interface Window { __SSR__?: PageStatusResponse }
}

export default function App() {
    if (window.__SSR__) return <StatusPage page={window.__SSR__.page} ssrData={window.__SSR__} />
    else return <span>something went wrong</span>
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TooltipProvider>
            <App />
        </TooltipProvider>
    </StrictMode>
)