import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import StatusPage from './StatusPage'
import { Hour24Bar } from './HistoryBar'

import type { Group, HourHistory, Page, PageStatusResponse, Service } from '../types'

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`)
    return res.json()
}

interface ServicesResponse {
    services: Service[]
    tags: string[]
}

interface ServiceHistory {
    id: string
    hour24: HourHistory[]
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
    const [services, setServices] = useState<Service[]>([])
    const [tags, setTags] = useState<string[]>([])
    const [pages, setPages] = useState<Page[]>([])
    const [search, setSearch] = useState('')
    const [editSvc, setEditSvc] = useState<Partial<Service> | null>(null)
    const [editPage, setEditPage] = useState<Page | null>(null)
    const [previewPage, setPreviewPage] = useState<Page | null>(null)
    const [previewData, setPreviewData] = useState<PageStatusResponse | null>(null)
    const [svcDrawerOpen, setSvcDrawerOpen] = useState(false)
    const [pageEditorOpen, setPageEditorOpen] = useState(false)
    const [previewOpen, setPreviewOpen] = useState(false)
    const [customTagMode, setCustomTagMode] = useState(false)
    const [history, setHistory] = useState<ServiceHistory[]>([])

    const loadServices = () =>
        api<ServicesResponse>('GET', '/api/services').then(d => {
            setServices(d.services)
            setTags(d.tags)
        })

    const loadHistory = () =>
        api<{ history: ServiceHistory[] }>('GET', '/api/services/history').then(d => setHistory(d.history))

    const loadPages = () =>
        api<{ pages: Page[] }>('GET', '/api/pages').then(d => setPages(d.pages))

    useEffect(() => {
        loadServices()
        loadHistory()
        loadPages()
        const t = setInterval(() => { loadServices(); loadHistory() }, 15_000)
        return () => clearInterval(t)
    }, [])

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        onLogout()
    }

    const openNewService = () => {
        setEditSvc({ name: '', url: '', intervalSeconds: 10, tag: '' })
        setCustomTagMode(false)
        setSvcDrawerOpen(true)
    }

    const openEditService = (svc: Service) => {
        setEditSvc({ ...svc })
        setCustomTagMode(svc.tag ? !tags.includes(svc.tag) : false)
        setSvcDrawerOpen(true)
    }

    const saveSvc = async () => {
        if (!editSvc) return
        if (editSvc.id) {
            await api('PUT', `/api/services/${editSvc.id}`, editSvc)
        } else {
            await api('POST', '/api/services', editSvc)
        }
        setSvcDrawerOpen(false)
        setEditSvc(null)
        loadServices()
    }

    const deleteSvc = async () => {
        if (!editSvc?.id) return
        await api('DELETE', `/api/services/${editSvc.id}`)
        setSvcDrawerOpen(false)
        setEditSvc(null)
        loadServices()
    }

    const openNewPage = () => {
        setEditPage({ id: '', name: '', hostname: '', title: '', description: '', footerText: '', iconUrl: '', groups: [] })
        setPageEditorOpen(true)
    }

    const openEditPage = (page: Page) => {
        setEditPage({ ...page, groups: page.groups ? [...page.groups.map(g => ({ ...g, services: [...g.services] }))] : [] })
        setPageEditorOpen(true)
    }

    const savePage = async () => {
        if (!editPage) return
        if (editPage.id) {
            await api('PUT', `/api/pages/${editPage.id}`, editPage)
        } else {
            await api('POST', '/api/pages', editPage)
        }
        setPageEditorOpen(false)
        setEditPage(null)
        loadPages()
    }

    const deletePage = async () => {
        if (!editPage?.id) return
        await api('DELETE', `/api/pages/${editPage.id}`)
        setPageEditorOpen(false)
        setEditPage(null)
        loadPages()
    }

    const openPreview = async (page: Page) => {
        setPreviewPage(page)
        setPreviewOpen(true)
        const data = await api<PageStatusResponse>('GET', `/api/pages/${page.id}/status`)
        setPreviewData(data)
    }

    const downCount = services.filter(s => !s.up).length

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.url.toLowerCase().includes(search.toLowerCase()) ||
        s.tag.toLowerCase().includes(search.toLowerCase())
    )

    const grouped: Record<string, Service[]> = {}
    const untagged: Service[] = []
    for (const svc of filteredServices) {
        if (svc.tag) {
            if (!grouped[svc.tag]) grouped[svc.tag] = []
            grouped[svc.tag].push(svc)
        } else {
            untagged.push(svc)
        }
    }

    return (
        <div className='min-h-svh flex flex-col'>
            <header className='border-b px-6 py-3 flex items-center justify-between'>
                <span className='font-semibold'>ping</span>
                <Button variant='ghost' size='sm' onClick={logout}>Logout</Button>
            </header>

            <div className='flex-1 max-w-3xl mx-auto w-full px-4 py-6'>
                <Tabs defaultValue='services' className='gap-0'>
                    <TabsList className='mb-6 w-full'>
                        <TabsTrigger value='services'>Services</TabsTrigger>
                        <TabsTrigger value='pages'>Status Pages</TabsTrigger>
                    </TabsList>

                    <TabsContent value='services'>
                        <div className={`rounded-lg px-4 py-3 mb-6 text-sm font-medium ${downCount > 0
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                            : 'bg-green-500/10 text-green-700 dark:text-green-400'
                            }`}>
                            {downCount > 0 ? `${downCount} service${downCount > 1 ? 's' : ''} down` : 'All systems operational'}
                        </div>

                        <div className='flex gap-2 mb-5'>
                            <Input
                                placeholder='Search services...'
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className='flex-1 h-9'
                            />

                            <Button className='min-w-28 h-9' onClick={openNewService}>Add service</Button>
                        </div>

                        <div className='space-y-6'>
                            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([tag, svcs]) => (
                                <div key={tag}>
                                    <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2'>{tag}</p>
                                    <div className='border rounded-lg divide-y'>
                                        {svcs.map(svc => {
                                            const h = history.find(h => h.id === svc.id)
                                            return (
                                                <button
                                                    key={svc.id}
                                                    onClick={() => openEditService(svc)}
                                                    className='w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left transition-colors'
                                                >
                                                    <span className={`inline-block shrink-0 size-2 rounded-full ${svc.up ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <span className='font-medium text-sm shrink-0'>{svc.name}</span>
                                                    <span className='text-xs text-muted-foreground shrink-0'>{new URL(svc.url).origin}</span>
                                                    {h && <div className='flex-1 flex justify-end'><div className='w-96'><Hour24Bar hours={h.hour24} createdAt={svc.createdAt} /></div></div>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}

                            {untagged.length > 0 && (
                                <div>
                                    {Object.keys(grouped).length > 0 && (
                                        <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2'>Uncategorized</p>
                                    )}
                                    <div className='border rounded-lg divide-y'>
                                        {untagged.map(svc => {
                                            const h = history.find(h => h.id === svc.id)
                                            return (
                                                <button
                                                    key={svc.id}
                                                    onClick={() => openEditService(svc)}
                                                    className='w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left transition-colors'
                                                >
                                                    <span className={`inline-block shrink-0 size-2 rounded-full ${svc.up ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <span className='font-medium text-sm shrink-0'>{svc.name}</span>
                                                    <span className='text-xs text-muted-foreground shrink-0'>{new URL(svc.url).origin}</span>
                                                    {h && <div className='flex-1 flex justify-end'><div className='w-96'><Hour24Bar hours={h.hour24} createdAt={svc.createdAt} /></div></div>}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {filteredServices.length === 0 && (
                                <p className='text-sm text-muted-foreground text-center py-8'>
                                    {services.length === 0 ? 'No services yet.' : 'No results.'}
                                </p>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value='pages'>
                        <div className='flex justify-end mb-4'>
                            <Button onClick={openNewPage}>Add page</Button>
                        </div>
                        {pages.length === 0 ? (
                            <p className='text-sm text-muted-foreground text-center py-8'>No status pages yet.</p>
                        ) : (
                            <div className='border rounded-lg divide-y'>
                                {pages.map(page => (
                                    <div key={page.id} className='flex items-center justify-between px-4 py-3'>
                                        <div>
                                            <p className='font-medium text-sm'>{page.name}</p>
                                            <p className='text-xs text-muted-foreground'>{page.hostname}</p>
                                        </div>
                                        <div className='flex gap-2'>
                                            <Button variant='outline' size='sm' onClick={() => openPreview(page)}>Preview</Button>
                                            <Button variant='outline' size='sm' onClick={() => window.open(`https://${page.hostname}`)}>Open</Button>
                                            <Button variant='outline' size='sm' onClick={() => openEditPage(page)}>Edit</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <Sheet open={svcDrawerOpen} onOpenChange={open => { setSvcDrawerOpen(open); if (!open) setEditSvc(null) }}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{editSvc?.id ? 'Edit service' : 'Add service'}</SheetTitle>
                    </SheetHeader>
                    {editSvc && (
                        <div className='flex flex-col gap-4 px-4 py-4'>
                            <div className='space-y-1.5'>
                                <Label>Name</Label>
                                <Input value={editSvc.name ?? ''} onChange={e => setEditSvc(s => ({ ...s!, name: e.target.value }))} />
                            </div>
                            <div className='space-y-1.5'>
                                <Label>URL</Label>
                                <Input value={editSvc.url ?? ''} onChange={e => setEditSvc(s => ({ ...s!, url: e.target.value }))} placeholder='https://' />
                            </div>
                            <div className='space-y-1.5'>
                                <Label>Ping interval (seconds)</Label>
                                <Input
                                    type='number'
                                    min={1}
                                    value={editSvc.intervalSeconds ?? 10}
                                    onChange={e => setEditSvc(s => ({ ...s!, intervalSeconds: parseInt(e.target.value) || 10 }))}
                                />
                            </div>
                            <div className='space-y-1.5'>
                                <Label>Category tag</Label>
                                {tags.length > 0 ? (
                                    <Select
                                        value={customTagMode ? '__custom' : (editSvc.tag || '')}
                                        onValueChange={v => {
                                            if (v === '__custom') { setCustomTagMode(true); setEditSvc(s => ({ ...s!, tag: '' })) }
                                            else { setCustomTagMode(false); setEditSvc(s => ({ ...s!, tag: v })) }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder='No tag' />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {tags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                            <SelectItem value='__custom'>Custom...</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : null}
                                {(tags.length === 0 || customTagMode) && (
                                    <Input
                                        placeholder='Tag name'
                                        value={editSvc.tag ?? ''}
                                        onChange={e => setEditSvc(s => ({ ...s!, tag: e.target.value }))}
                                        autoFocus={customTagMode}
                                    />
                                )}
                            </div>
                            <div className='flex gap-2 mt-2'>
                                <Button className='flex-1' onClick={saveSvc}>Save</Button>
                                {editSvc.id && (
                                    <Button variant='destructive' onClick={deleteSvc}>Delete</Button>
                                )}
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <Sheet open={pageEditorOpen} onOpenChange={open => { setPageEditorOpen(open); if (!open) setEditPage(null) }}>
                <SheetContent className='w-full sm:max-w-xl overflow-y-auto'>
                    <SheetHeader>
                        <SheetTitle>{editPage?.id ? 'Edit status page' : 'New status page'}</SheetTitle>
                    </SheetHeader>
                    {editPage && (
                        <PageEditorForm
                            page={editPage}
                            services={services}
                            onChange={setEditPage}
                            onSave={savePage}
                            onDelete={editPage.id ? deletePage : undefined}
                        />
                    )}
                </SheetContent>
            </Sheet>

            <Sheet open={previewOpen} onOpenChange={open => { setPreviewOpen(open); if (!open) { setPreviewPage(null); setPreviewData(null) } }}>
                <SheetContent className='w-full sm:max-w-2xl overflow-y-auto p-0'>
                    {previewPage && previewData && (
                        <StatusPage page={previewPage} previewData={previewData} />
                    )}
                    {previewPage && !previewData && (
                        <div className='flex items-center justify-center h-full text-muted-foreground text-sm'>Loading preview...</div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

function PageEditorForm({
    page,
    services,
    onChange,
    onSave,
    onDelete,
}: {
    page: Page
    services: Service[]
    onChange: (p: Page) => void
    onSave: () => void
    onDelete?: () => void
}) {
    const set = (field: keyof Page, value: unknown) => onChange({ ...page, [field]: value })

    const addGroup = () => {
        const g: Group = { id: Math.random().toString(36).slice(2), name: 'New group', order: page.groups.length, services: [] }
        onChange({ ...page, groups: [...page.groups, g] })
    }

    const updateGroup = (idx: number, g: Group) => {
        const groups = [...page.groups]
        groups[idx] = g
        onChange({ ...page, groups })
    }

    const removeGroup = (idx: number) => {
        const groups = page.groups.filter((_, i) => i !== idx)
        onChange({ ...page, groups })
    }

    const moveGroup = (idx: number, dir: -1 | 1) => {
        const groups = [...page.groups]
        const target = idx + dir
        if (target < 0 || target >= groups.length) return
            ;[groups[idx], groups[target]] = [groups[target], groups[idx]]
        groups.forEach((g, i) => (g.order = i))
        onChange({ ...page, groups })
    }

    return (
        <div className='flex flex-col gap-4 px-4 py-4'>
            <div className='space-y-1.5'>
                <Label>Slug</Label>
                <Input value={page.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className='space-y-1.5'>
                <Label>Hostname</Label>
                <Input value={page.hostname} onChange={e => set('hostname', e.target.value)} placeholder='status.example.com' />
            </div>
            <div className='space-y-1.5'>
                <Label>Title</Label>
                <Input value={page.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className='space-y-1.5'>
                <Label>Description</Label>
                <Input value={page.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className='space-y-1.5'>
                <Label>Footer text</Label>
                <Input value={page.footerText} onChange={e => set('footerText', e.target.value)} />
            </div>
            <div className='space-y-1.5'>
                <Label>Icon URL</Label>
                <Input value={page.iconUrl} onChange={e => set('iconUrl', e.target.value)} placeholder='https://...' />
            </div>

            <Separator />

            <div className='flex items-center justify-between'>
                <span className='text-sm font-medium'>Groups</span>
                <Button size='sm' variant='outline' onClick={addGroup}>Add group</Button>
            </div>

            <div className='space-y-4'>
                {[...page.groups].sort((a, b) => a.order - b.order).map((group, idx) => (
                    <GroupEditor
                        key={group.id}
                        group={group}
                        services={services}
                        onUpdate={g => updateGroup(idx, g)}
                        onRemove={() => removeGroup(idx)}
                        onMoveUp={idx > 0 ? () => moveGroup(idx, -1) : undefined}
                        onMoveDown={idx < page.groups.length - 1 ? () => moveGroup(idx, 1) : undefined}
                    />
                ))}
            </div>

            <div className='flex gap-2 mt-2'>
                <Button className='flex-1' onClick={onSave}>Save</Button>
                {onDelete && <Button variant='destructive' onClick={onDelete}>Delete</Button>}
            </div>
        </div>
    )
}

function GroupEditor({
    group,
    services,
    onUpdate,
    onRemove,
    onMoveUp,
    onMoveDown,
}: {
    group: Group
    services: Service[]
    onUpdate: (g: Group) => void
    onRemove: () => void
    onMoveUp?: () => void
    onMoveDown?: () => void
}) {
    const [svcSearch, setSvcSearch] = useState('')

    const availableServices = services.filter(
        s => !group.services.includes(s.id) &&
            (s.name.toLowerCase().includes(svcSearch.toLowerCase()) ||
                s.tag.toLowerCase().includes(svcSearch.toLowerCase()))
    )

    const addService = (id: string) => {
        onUpdate({ ...group, services: [...group.services, id] })
        setSvcSearch('')
    }

    const removeService = (id: string) => {
        onUpdate({ ...group, services: group.services.filter(s => s !== id) })
    }

    const moveService = (idx: number, dir: -1 | 1) => {
        const svcs = [...group.services]
        const target = idx + dir
        if (target < 0 || target >= svcs.length) return
            ;[svcs[idx], svcs[target]] = [svcs[target], svcs[idx]]
        onUpdate({ ...group, services: svcs })
    }

    return (
        <div className='border rounded-lg p-3 space-y-3'>
            <div className='flex items-center gap-2'>
                <Input
                    className='flex-1 h-7 text-sm'
                    value={group.name}
                    onChange={e => onUpdate({ ...group, name: e.target.value })}
                />
                <div className='flex gap-1'>
                    <Button size='icon-xs' variant='ghost' onClick={onMoveUp} disabled={!onMoveUp}>↑</Button>
                    <Button size='icon-xs' variant='ghost' onClick={onMoveDown} disabled={!onMoveDown}>↓</Button>
                    <Button size='icon-xs' variant='destructive' onClick={onRemove}>×</Button>
                </div>
            </div>

            <div className='space-y-1'>
                {group.services.map((sid, i) => {
                    const svc = services.find(s => s.id === sid)
                    return (
                        <div key={sid} className='flex items-center gap-1 text-sm'>
                            <span className='flex-1 truncate'>{svc?.name ?? sid}</span>
                            <Button size='icon-xs' variant='ghost' onClick={() => moveService(i, -1)} disabled={i === 0}>↑</Button>
                            <Button size='icon-xs' variant='ghost' onClick={() => moveService(i, 1)} disabled={i === group.services.length - 1}>↓</Button>
                            <Button size='icon-xs' variant='ghost' onClick={() => removeService(sid)}>×</Button>
                        </div>
                    )
                })}
            </div>

            <div className='relative'>
                <Input
                    className='h-7 text-sm'
                    placeholder='Add service...'
                    value={svcSearch}
                    onChange={e => setSvcSearch(e.target.value)}
                />
                {svcSearch && availableServices.length > 0 && (
                    <div className='absolute z-10 mt-1 w-full border rounded-md bg-popover shadow-md'>
                        {availableServices.slice(0, 6).map(s => (
                            <button
                                key={s.id}
                                className='w-full text-left px-3 py-1.5 text-sm hover:bg-muted'
                                onClick={() => addService(s.id)}
                            >
                                {s.name}
                                {s.tag && <span className='text-muted-foreground ml-1 text-xs'>({s.tag})</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
