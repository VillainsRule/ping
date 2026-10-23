import { useEffect, useState } from 'react'

import { Separator } from '@/components/ui/separator'

import { HistoryBar } from './HistoryBar'

import type { Page, PageStatusResponse, ServiceStatus } from '../types'

function setFavicon(url: string) {
    const el = document.getElementById('favicon') as HTMLLinkElement | null
    if (el && url) el.href = url
}

function ServiceRow({ svc, services }: { svc: { id: string }, services: ServiceStatus[] }) {
    const status = services.find(s => s.id === svc.id)
    if (!status) return null
    return (
        <div className='flex flex-col gap-2 py-3'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                    <span className={`inline-block size-2 rounded-full ${status.up ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className='font-medium text-sm'>{status.name}</span>
                </div>
                <span className='text-xs text-muted-foreground'>
                    {status.up ? 'Working' : `Down${status.currentStatusCode ? ` (${status.currentStatusCode})` : ''}`}
                </span>
            </div>
            <HistoryBar history={status.day30} createdAt={status.createdAt} />
            <div className='flex justify-between text-xs text-muted-foreground'>
                <span>30 days ago</span>
                <span>Today</span>
            </div>
        </div>
    )
}

export default function StatusPage({ page, previewData, ssrData }: { page: Page; previewData?: PageStatusResponse; ssrData?: PageStatusResponse }) {
    const [data, setData] = useState<PageStatusResponse | null>(previewData ?? ssrData ?? null)

    useEffect(() => {
        if (page.iconUrl) {
            setFavicon(page.iconUrl)
            document.title = page.title || 'Status'
        }
    }, [page])

    useEffect(() => {
        if (previewData) return
        const load = () =>
            fetch('/api/public/status')
                .then(r => r.json())
                .then(setData)
        if (!ssrData) load()
        const interval = setInterval(load, 30_000)
        return () => clearInterval(interval)
    }, [previewData, ssrData])

    const downCount = data?.services.filter(s => !s.up).length ?? 0
    const sortedGroups = [...(page.groups ?? [])].sort((a, b) => a.order - b.order)

    return (
        <div className='min-h-svh flex flex-col'>
            <div className='max-w-2xl mx-auto w-full px-4 py-10 flex-1'>
                <div className='flex items-center justify-between mb-8 gap-6'>
                    <div className='flex items-center gap-3 min-w-fit'>
                        {page.iconUrl && (
                            <img src={page.iconUrl} alt='' className='size-8 rounded' />
                        )}
                        <h1 className='text-2xl font-semibold'>{page.title || page.name}</h1>
                    </div>
                    {page.description && (
                        <p className='text-muted-foreground text-sm'>{page.description}</p>
                    )}

                    <div className={`rounded-lg w-full py-2 text-sm font-medium text-center ${downCount > 0
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-green-500/10 text-green-700 dark:text-green-400'
                        }`}>
                        {downCount > 0 ? `${downCount} service${downCount > 1 ? 's' : ''} down` : 'all systems operational!'}
                    </div>
                </div>

                {data && sortedGroups.map(group => (
                    <div key={group.id} className='mb-8'>
                        <h2 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3'>
                            {group.name}
                        </h2>

                        <div className='border rounded-lg divide-y'>
                            {group.services.map(sid => (
                                <div key={sid} className='px-4'>
                                    <ServiceRow svc={{ id: sid }} services={data.services} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {page.footerText && (
                <>
                    <Separator />

                    <footer className='text-center text-xs text-muted-foreground py-4'>
                        {page.footerText}
                    </footer>
                </>
            )}
        </div>
    )
}
