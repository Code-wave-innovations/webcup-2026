import { keepPreviousData, useMutation, useQueries, useQuery } from '@tanstack/react-query'
import { defineMessages, messagesFor, type Locale } from '../i18n'
import { http } from './client'
import { queryClient, REFRESH } from './queryClient'
import type { DayType, TransitLine, TransitLineDetail, TransitLineStatus, TransitLineSummary, TransitMode, TransitStop, TransitStopBase, TransitStopDetail } from './types'

// F36: municipal transport (GET /api/transit/*, public; managing lines and stops is open to the staff)

const modeMessages = defineMessages(
  { BUS: 'Bus', TRAM: 'Tram', METRO: 'Métro', SHUTTLE: 'Navette', CABLE: 'Téléphérique' },
  { BUS: 'Bus', TRAM: 'Tram', METRO: 'Metro', SHUTTLE: 'Shuttle', CABLE: 'Cable car' },
)

const statusMessages = defineMessages(
  { NORMAL: 'Trafic normal', DISRUPTED: 'Perturbée', INTERRUPTED: 'Interrompue' },
  { NORMAL: 'Normal service', DISRUPTED: 'Disrupted', INTERRUPTED: 'Suspended' },
)

const dayTypeMessages = defineMessages(
  { WEEKDAY: 'Lundi au vendredi', SATURDAY: 'Samedi', SUNDAY: 'Dimanche et jours fériés' },
  { WEEKDAY: 'Monday to Friday', SATURDAY: 'Saturday', SUNDAY: 'Sunday and public holidays' },
)

/** French snapshot for the back-office (always FR). Citizen UI: `transit*Label(..., locale)`. */
export const TRANSIT_MODE_LABEL = modeMessages.fr
export const TRANSIT_STATUS_LABEL = statusMessages.fr
export const DAY_TYPE_LABEL = dayTypeMessages.fr

export const transitModeLabel = (mode: TransitMode, locale?: Locale) => messagesFor(modeMessages, locale)[mode]
export const transitStatusLabel = (status: TransitLineStatus, locale?: Locale) => messagesFor(statusMessages, locale)[status]
export const dayTypeLabel = (day: DayType, locale?: Locale) => messagesFor(dayTypeMessages, locale)[day]

export const DAY_TYPES = Object.keys(dayTypeMessages.fr) as DayType[]

export interface StopFilters {
  district_id?: number
  line_id?: number
  q?: string
}

export const transitKeys = {
  all: ['transit'] as const,
  lines: (includeInactive: boolean) => [...transitKeys.all, 'lines', includeInactive] as const,
  line: (idOrCode: string, day?: DayType) => [...transitKeys.all, 'line', idOrCode, day ?? 'today'] as const,
  disruptions: () => [...transitKeys.all, 'disruptions'] as const,
  stops: (filters: StopFilters) => [...transitKeys.all, 'stops', filters] as const,
  stop: (id: number) => [...transitKeys.all, 'stop', id] as const,
}

/** Inactive lines are only returned to the staff */
export const useTransitLines = (includeInactive = false) =>
  useQuery({
    queryKey: transitKeys.lines(includeInactive),
    queryFn: () => http.get<TransitLine[]>('/transit/lines', { params: includeInactive ? { include_inactive: true } : {} }).then((r) => r.data),
    // F95: the list changes only when the staff edits it; a disruption shows through useTransitDisruptions
    refetchInterval: REFRESH.reference,
  })

/** Without `day`, the server picks today's day type */
export const useTransitLine = (idOrCode: string | undefined, day?: DayType) =>
  useQuery({
    queryKey: transitKeys.line(idOrCode ?? '', day),
    queryFn: () => http.get<TransitLineDetail>(`/transit/lines/${encodeURIComponent(idOrCode!)}`, { params: { day } }).then((r) => r.data),
    enabled: !!idOrCode,
    placeholderData: keepPreviousData,
    // F95: a whole day's timetable, which only the staff changes
    refetchInterval: REFRESH.reference,
  })

/** Lines not running normally */
export const useTransitDisruptions = () =>
  useQuery({
    queryKey: transitKeys.disruptions(),
    queryFn: () => http.get<TransitLineSummary[]>('/transit/disruptions').then((r) => r.data),
    refetchInterval: REFRESH.transit,
  })

export const useTransitStops = (filters: StopFilters, enabled = true) =>
  useQuery({
    queryKey: transitKeys.stops(filters),
    queryFn: () => http.get<TransitStop[]>('/transit/stops', { params: filters }).then((r) => r.data),
    enabled,
    placeholderData: keepPreviousData,
    // F95: stops are reference data; their departures are polled separately
    refetchInterval: REFRESH.reference,
  })

const fetchStop = (id: number) => http.get<TransitStopDetail>(`/transit/stops/${id}`, { params: { limit: 20 } }).then((r) => r.data)

/** Next departures at one stop, from now */
export const useTransitStop = (id: number | undefined) =>
  useQuery({
    queryKey: transitKeys.stop(id ?? 0),
    queryFn: () => fetchStop(id!),
    enabled: id !== undefined && id > 0,
    refetchInterval: REFRESH.transit,
  })

/** Next departures at several stops (favourites, the stops of a district), one query each */
export const useTransitStopsDepartures = (ids: number[]) =>
  useQueries({
    queries: ids.map((id) => ({
      queryKey: transitKeys.stop(id),
      queryFn: () => fetchStop(id),
      refetchInterval: REFRESH.transit,
    })),
  })

/* ─── Staff ──────────────────────────────────────────────────────────────── */

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: transitKeys.all })
  void queryClient.invalidateQueries({ queryKey: ['home'] })
}

export interface LineStatusInput {
  status: TransitLineStatus
  status_message?: string | null
  /** notify the residents of the districts served by the line */
  notify?: boolean
}

/** Any staff member; answers how many residents were notified */
export const useUpdateLineStatus = () =>
  useMutation({
    mutationFn: ({ id, ...input }: LineStatusInput & { id: number }) =>
      http.patch<TransitLine & { notified: number }>(`/transit/lines/${id}/status`, input).then((r) => r.data),
    onSuccess: refresh,
  })

export type LineInput = Partial<Pick<TransitLine, 'code' | 'name' | 'mode' | 'color' | 'description' | 'is_active'>>

export const useSaveLine = () =>
  useMutation({
    mutationFn: ({ id, ...input }: LineInput & { id?: number }) =>
      (id ? http.patch<TransitLine>(`/transit/lines/${id}`, input) : http.post<TransitLine>('/transit/lines', input)).then((r) => r.data),
    onSuccess: refresh,
  })

export const useDeleteLine = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/transit/lines/${id}`).then((r) => r.data),
    onSuccess: refresh,
  })

/** Replaces the ordered list of stops of a line */
export const useSetLineStops = () =>
  useMutation({
    mutationFn: ({ id, stop_ids }: { id: number; stop_ids: number[] }) => http.put(`/transit/lines/${id}/stops`, { stop_ids }).then((r) => r.data),
    onSuccess: refresh,
  })

/** A regular service generated by the server from the line's stop order (same rule as backoffice/lib/timetable) */
export interface TimetableInput {
  day_type: DayType
  first: string
  last: string
  every_minutes: number
  minutes_between_stops: number
  /** also run back from the last stop to the first one (default true) */
  return_trip?: boolean
}

/** Replaces the timetable of one day type */
export const useSetTimetable = () =>
  useMutation({
    mutationFn: ({ id, ...input }: TimetableInput & { id: number }) =>
      http.put<{ line_id: number; day_type: DayType; departures: number }>(`/transit/lines/${id}/timetable`, input).then((r) => r.data),
    onSuccess: refresh,
  })

export type StopInput = Partial<Pick<TransitStopBase, 'code' | 'name' | 'district_id' | 'address' | 'accessible'>>

export const useSaveStop = () =>
  useMutation({
    mutationFn: ({ id, ...input }: StopInput & { id?: number }) =>
      (id ? http.patch<TransitStopBase>(`/transit/stops/${id}`, input) : http.post<TransitStopBase>('/transit/stops', input)).then((r) => r.data),
    onSuccess: refresh,
  })

export const useDeleteStop = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/transit/stops/${id}`).then((r) => r.data),
    onSuccess: refresh,
  })
