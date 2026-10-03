import { create } from 'zustand'
import { AUDIT_LOGS, LIVE_TEMPLATES } from '../mocks/audit'
import type { AuditLog } from '../mocks/types'

interface AuditState {
  logs: AuditLog[]
  /** id of the most recent entry, to flash it in live feeds */
  latestId: number
}

let nextId = AUDIT_LOGS.length + 1

export const useAuditStore = create<AuditState>()(() => ({
  logs: AUDIT_LOGS,
  latestId: 0,
}))

/** F47 / F48: every simulated action leaves a trace, like the future backend AuditLog table. */
export function recordAudit(entry: Omit<AuditLog, 'id' | 'at' | 'ip'> & { ip?: string }): void {
  const log: AuditLog = { ip: '10.4.0.21', ...entry, id: nextId++, at: new Date().toISOString() }
  useAuditStore.setState((s) => ({ logs: [log, ...s.logs], latestId: log.id }))
}

let liveTimer: ReturnType<typeof setInterval> | undefined
let liveUsers = 0
let templateIndex = 0

/** Simulated activity from other staff while a live feed is on screen. Returns the stop function. */
export function startLiveAudit(intervalMs = 9000): () => void {
  liveUsers += 1
  if (!liveTimer) {
    liveTimer = setInterval(() => {
      const template = LIVE_TEMPLATES[templateIndex++ % LIVE_TEMPLATES.length]
      recordAudit(template)
    }, intervalMs)
  }
  return () => {
    liveUsers -= 1
    if (liveUsers === 0 && liveTimer) {
      clearInterval(liveTimer)
      liveTimer = undefined
    }
  }
}
