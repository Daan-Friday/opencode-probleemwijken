import type { SchaamModusConfig } from "./config"
import { refreshAccessToken, hasValidTokens } from "./auth"

interface CalendarEvent {
  start: Date
  end: Date
  summary: string
}

// Cache for calendar events
let cachedEvents: CalendarEvent[] = []
let lastFetch: number = 0

function parseICalDate(dateStr: string): Date {
  // Handle formats like: 20260122T140000Z or 20260122
  if (dateStr.includes("T")) {
    // DateTime format: YYYYMMDDTHHMMSSZ
    const year = parseInt(dateStr.slice(0, 4))
    const month = parseInt(dateStr.slice(4, 6)) - 1
    const day = parseInt(dateStr.slice(6, 8))
    const hour = parseInt(dateStr.slice(9, 11))
    const minute = parseInt(dateStr.slice(11, 13))
    const second = parseInt(dateStr.slice(13, 15))
    
    if (dateStr.endsWith("Z")) {
      return new Date(Date.UTC(year, month, day, hour, minute, second))
    }
    return new Date(year, month, day, hour, minute, second)
  } else {
    // Date only format: YYYYMMDD (all-day event)
    const year = parseInt(dateStr.slice(0, 4))
    const month = parseInt(dateStr.slice(4, 6)) - 1
    const day = parseInt(dateStr.slice(6, 8))
    return new Date(year, month, day)
  }
}

function parseICalEvents(icalData: string): CalendarEvent[] {
  const events: CalendarEvent[] = []
  const lines = icalData.split(/\r?\n/)
  
  let inEvent = false
  let currentEvent: Partial<CalendarEvent> = {}
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    
    // Handle line continuations (lines starting with space or tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(" ") || lines[i + 1].startsWith("\t"))) {
      i++
      line += lines[i].slice(1)
    }
    
    if (line === "BEGIN:VEVENT") {
      inEvent = true
      currentEvent = {}
    } else if (line === "END:VEVENT") {
      inEvent = false
      if (currentEvent.start && currentEvent.end) {
        events.push(currentEvent as CalendarEvent)
      }
    } else if (inEvent) {
      // Parse DTSTART
      if (line.startsWith("DTSTART")) {
        const value = line.split(":").pop() ?? ""
        currentEvent.start = parseICalDate(value)
      }
      // Parse DTEND
      else if (line.startsWith("DTEND")) {
        const value = line.split(":").pop() ?? ""
        currentEvent.end = parseICalDate(value)
      }
      // Parse SUMMARY
      else if (line.startsWith("SUMMARY")) {
        currentEvent.summary = line.split(":").slice(1).join(":") ?? ""
      }
    }
  }
  
  return events
}

async function fetchCalendarViaIcal(url: string): Promise<CalendarEvent[]> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return []
    }
    const icalData = await response.text()
    return parseICalEvents(icalData)
  } catch {
    return []
  }
}

async function fetchCalendarViaOAuth(): Promise<CalendarEvent[]> {
  const accessToken = await refreshAccessToken()
  
  if (!accessToken) {
    return []
  }
  
  try {
    // Get events from now to end of day
    const now = new Date()
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
    })
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    if (!response.ok) {
      return []
    }
    
    const data = await response.json()
    const events: CalendarEvent[] = []
    
    for (const item of data.items || []) {
      // Skip cancelled events
      if (item.status === "cancelled") continue
      
      const start = item.start?.dateTime 
        ? new Date(item.start.dateTime)
        : item.start?.date 
          ? new Date(item.start.date)
          : null
          
      const end = item.end?.dateTime
        ? new Date(item.end.dateTime)
        : item.end?.date
          ? new Date(item.end.date)
          : null
      
      if (start && end) {
        events.push({
          start,
          end,
          summary: item.summary || "Busy",
        })
      }
    }
    
    return events
  } catch {
    return []
  }
}

export async function isInMeeting(config: SchaamModusConfig): Promise<boolean> {
  if (!config.enabled) {
    return false
  }
  
  const now = Date.now()
  const cacheExpiry = config.checkIntervalMinutes * 60 * 1000
  
  // Refresh cache if expired
  if (now - lastFetch > cacheExpiry) {
    // Prefer OAuth if tokens are available
    if (hasValidTokens()) {
      cachedEvents = await fetchCalendarViaOAuth()
    } else if (config.calendarUrl) {
      // Fall back to iCal URL
      cachedEvents = await fetchCalendarViaIcal(config.calendarUrl)
    } else {
      cachedEvents = []
    }
    lastFetch = now
  }
  
  const currentTime = new Date()
  
  // Check if any event is currently happening
  for (const event of cachedEvents) {
    if (currentTime >= event.start && currentTime <= event.end) {
      return true
    }
  }
  
  return false
}
