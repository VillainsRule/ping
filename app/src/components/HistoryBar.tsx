import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import type { DayHistory, HourHistory } from '../types'

function formatDuration(ms: number) {
    const s = Math.round(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.round(s / 60)
    if (m < 60) return `${m}m`
    const h = (s / 3600).toFixed(1)
    return `${h}h`
}

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function Day30Bar({ days, createdAt }: { days: DayHistory[]; createdAt?: number }) {
    return (
        <div className='flex gap-px h-8'>
            {days.map(day => {
                const dayStartMs = new Date(day.date + 'T00:00:00Z').getTime()
                const dayEndMs = dayStartMs + 86400000
                const isPreCreation = createdAt ? dayEndMs <= createdAt : false

                if (isPreCreation) return (
                    <Tooltip key={day.date}>
                        <TooltipTrigger asChild>
                            <div className='flex-1 rounded-sm bg-zinc-300/60 dark:bg-zinc-700/50' />
                        </TooltipTrigger>
                        <TooltipContent side='top'>
                            <p className='font-medium'>{day.date}</p>
                            <p className='text-muted-foreground text-xs'>Not yet monitored</p>
                        </TooltipContent>
                    </Tooltip>
                )

                const bar = (
                    <div className={`flex-1 rounded-sm ${day.up ? 'bg-green-500/80' : 'bg-red-500/80'}`} />
                )

                if (day.up) return (
                    <Tooltip key={day.date}>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent side='top'>
                            <p className='font-medium'>{day.date}</p>
                            <p className='text-muted-foreground text-xs'>No downtime</p>
                        </TooltipContent>
                    </Tooltip>
                )

                const total = day.incidents.reduce((acc, inc) => acc + (inc.end - inc.start), 0)

                return (
                    <Tooltip key={day.date}>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent side='top'>
                            <p className='font-medium'>{day.date}</p>
                            <p className='text-xs text-red-400'>Downtime: {formatDuration(total)}</p>
                            {day.incidents.map((inc, i) => (
                                <p key={i} className='text-xs text-muted-foreground'>
                                    {formatTime(inc.start)} – {inc.end ? formatTime(inc.end) : 'ongoing'}
                                    {inc.statusCode ? ` (${inc.statusCode})` : ' (timeout)'}
                                </p>
                            ))}
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}

export function Hour24Bar({ hours, createdAt }: { hours: HourHistory[]; createdAt?: number }) {
    return (
        <div className='flex gap-px h-6'>
            {hours.map((hour, i) => {
                const hourEndMs = hour.hourStart + 3600000
                const isPreCreation = createdAt ? hourEndMs <= createdAt : false
                const label = new Date(hour.hourStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                if (isPreCreation) {
                    return (
                        <Tooltip key={i}>
                            <TooltipTrigger asChild>
                                <div className='flex-1 rounded-sm bg-zinc-300/60 dark:bg-zinc-700/50' />
                            </TooltipTrigger>
                            <TooltipContent side='top'>
                                <p className='font-medium'>{label}</p>
                                <p className='text-xs text-muted-foreground'>Not yet monitored</p>
                            </TooltipContent>
                        </Tooltip>
                    )
                }

                const bar = (
                    <div
                        className={`flex-1 rounded-sm ${hour.up ? 'bg-green-500/80' : 'bg-red-500/80'}`}
                    />
                )
                return (
                    <Tooltip key={i}>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent side='top'>
                            <p className='font-medium'>{label}</p>
                            {hour.up ? (
                                <p className='text-xs text-muted-foreground'>No downtime</p>
                            ) : (
                                <>
                                    {hour.incidents.map((inc, j) => (
                                        <p key={j} className='text-xs text-red-400'>
                                            {formatTime(inc.start)} – {inc.end ? formatTime(inc.end) : 'ongoing'}
                                            {inc.statusCode ? ` (${inc.statusCode})` : ' (timeout)'}
                                        </p>
                                    ))}
                                </>
                            )}
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}
