import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import { cn } from '@/lib/utils.ts'

import type { DayHistory, HourHistory } from '../types'

function formatDuration(ms: number) {
    const s = Math.round(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.round(s / 60)
    if (m < 60) return `${m}m`
    const h = (s / 3600).toFixed(1)
    return `${h}h`
}

export function HistoryBar({ history, createdAt, className }: { history: DayHistory[] | HourHistory[]; createdAt?: number, className?: string }) {
    return (
        <div className={cn('flex gap-px h-8', className)}>
            {history.map((item, i) => {
                const isDay = 'date' in item;

                const endingMs = isDay ? new Date(item.date + 'T00:00:00Z').getTime() + 86400000 : item.hourStart + 3600000
                const isPreCreation = createdAt ? endingMs <= createdAt : false
                const label = isDay ? item.date : new Date(item.hourStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

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

                const totalDowntimeMinutes = item.downtimeMs / 60000
                const wasDownFullTime = item.wasDownFullTime

                const bar = (
                    <div className={`flex-1 rounded-sm ${item.up ? 'bg-green-500/80' : wasDownFullTime ? 'bg-red-500/80' : totalDowntimeMinutes >= 3 ? 'bg-orange-500/80' : 'bg-yellow-500/80'}`} />
                )

                if (item.downtimeMs === 0) return (
                    <Tooltip key={i}>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent side='top' className='flex-col text-center gap-0'>
                            <p className='font-medium'>{label}</p>
                            <p className='text-muted-foreground text-xs'>no downtime</p>
                        </TooltipContent>
                    </Tooltip>
                )

                return (
                    <Tooltip key={i}>
                        <TooltipTrigger asChild>{bar}</TooltipTrigger>
                        <TooltipContent side='top' className='flex-col text-center gap-0'>
                            <p className='font-medium'>{label}</p>
                            <p className='text-xs text-red-400'>downtime: {formatDuration(item.downtimeMs)}</p>
                        </TooltipContent>
                    </Tooltip>
                )
            })}
        </div>
    )
}