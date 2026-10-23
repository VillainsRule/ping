export interface Service {
    id: string
    name: string
    url: string
    intervalSeconds: number
    tag: string
    up: boolean
    currentStatusCode?: number | null
    createdAt?: number
}

export interface Group {
    id: string
    name: string
    order: number
    services: string[]
}

export interface Page {
    id: string
    name: string
    hostname: string
    title: string
    description: string
    footerText: string
    iconUrl: string
    groups: Group[]
}

export interface DayHistory {
    date: string
    up: boolean
    downtimeMs: number
    wasDownFullTime: boolean
}

export interface HourHistory {
    hourStart: number
    up: boolean
    downtimeMs: number
    wasDownFullTime: boolean
}

export interface ServiceStatus {
    id: string
    name: string
    url: string
    up: boolean
    currentStatusCode?: number | null
    createdAt?: number
    day30: DayHistory[]
    hour24: HourHistory[]
}

export interface PageStatusResponse {
    page: Page
    services: ServiceStatus[]
}

export interface InitResponse {
    mode: 'admin' | 'statuspage'
    loggedIn?: boolean
    voauthUrl?: string
    page?: Page
}
