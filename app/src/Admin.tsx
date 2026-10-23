import { createRoot } from 'react-dom/client'
import { StrictMode, useEffect, useState } from 'react'

import Login from './components/Login'
import Dashboard from './components/Dashboard'
import StatusPage from './components/StatusPage'

import type { InitResponse, PageStatusResponse } from './types'

import { TooltipProvider } from '@/components/ui/tooltip'

import './index.css'

declare global {
    interface Window { __SSR__?: PageStatusResponse }
}

function getStatusPageName() {
    const m = window.location.pathname.match(/^\/status\/([^/]+)/)
    return m ? decodeURIComponent(m[1]) : null
}

export default function App() {
    if (window.__SSR__) return <StatusPage page={window.__SSR__.page} ssrData={window.__SSR__} />

    const [init, setInit] = useState<InitResponse | null>(null)
    const [namedPageData, setNamedPageData] = useState<PageStatusResponse | null>(null)

    useEffect(() => {
        fetch('/api/init')
            .then(r => r.json())
            .then(setInit)
    }, [])

    const statusName = getStatusPageName()

    useEffect(() => {
        if (!statusName || !init?.loggedIn) return
        fetch(`/api/pages/by-name/${encodeURIComponent(statusName)}/status`)
            .then(r => r.ok ? r.json() : null)
            .then(setNamedPageData)
    }, [statusName, init?.loggedIn])

    if (!init) return null

    if (init.mode === 'statuspage' && init.page) {
        return <StatusPage page={init.page} />
    }

    if (init.mode === 'admin') {
        if (!init.loggedIn) return <Login voauthUrl={init.voauthUrl!} />
        if (statusName && namedPageData) return <StatusPage page={namedPageData.page} previewData={namedPageData} />
        return <Dashboard onLogout={() => setInit({ ...init, loggedIn: false })} />
    }

    return null
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <TooltipProvider>
            <App />
        </TooltipProvider>
    </StrictMode>
)