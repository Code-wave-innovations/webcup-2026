import axios from 'axios'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { http, rootApiUrl } from './client'
import { dashboardKeys } from './dashboard'
import { toApiError } from './errors'
import type { FormGuardPayload } from '../features/security/formGuard'
import { queryClient, REFRESH } from './queryClient'
import type { Paginated, RequestDetail, RequestListItem, RequestPriority, RequestStatus, RequestType, UpdatedRequest } from './types'

/**
 * The city film keeps its own session token. These calls send it themselves: the shared `http` client
 * would treat a 401 as an expired staff session and sign the back-office out.
 */
const filmHttp = axios.create({ baseURL: rootApiUrl })
filmHttp.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error)))

// D04 / D11 / F22 / F25 / F49: citizen requests as the staff processes them (/api/requests)

export interface RequestFilters {
  scope?: 'open' | 'needs_action' | 'closed'
  /** one or several states, comma-separated by the server */
  status?: RequestStatus[]
  type?: RequestType
  priority?: RequestPriority
  /** "me", "none" or an agent id */
  assigned?: 'me' | 'none' | number
  district_id?: number
  citizen_id?: number
  q?: string
  sort?: 'newest' | 'oldest' | 'priority' | 'updated'
  page?: number
  limit?: number
}

export interface RequestChanges {
  status?: RequestStatus
  priority?: RequestPriority
  assigned_agent_id?: number | null
  /** shown to the citizen unless internal_note; required for WAITING_CITIZEN, REJECTED and RESOLVED */
  note?: string
  internal_note?: boolean
}

export const requestKeys = {
  all: ['requests'] as const,
  lists: () => [...requestKeys.all, 'list'] as const,
  list: (filters: RequestFilters) => [...requestKeys.lists(), filters] as const,
  detail: (id: number) => [...requestKeys.all, 'detail', id] as const,
}

const toParams = ({ status, ...filters }: RequestFilters) => ({ ...filters, status: status?.join(',') || undefined })

/** Keeps the previous page on screen while the next filters load. */
export const useRequests = (filters: RequestFilters, enabled = true) =>
  useQuery({
    queryKey: requestKeys.list(filters),
    queryFn: () => http.get<Paginated<RequestListItem>>('/requests', { params: toParams(filters) }).then((r) => r.data),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH.dashboard,
  })

export const useRequest = (id: number | undefined) =>
  useQuery({
    queryKey: requestKeys.detail(id ?? 0),
    queryFn: () => http.get<RequestDetail>(`/requests/${id}`).then((r) => r.data),
    enabled: id !== undefined && Number.isInteger(id) && id > 0,
    refetchInterval: REFRESH.openRequest,
  })

/** Lists, counters and the activity feed all change with a request. */
const refreshAround = (id?: number) => {
  void queryClient.invalidateQueries({ queryKey: requestKeys.lists() })
  if (id) void queryClient.invalidateQueries({ queryKey: requestKeys.detail(id) })
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
}

export const useUpdateRequest = () =>
  useMutation({
    mutationFn: ({ id, ...changes }: RequestChanges & { id: number }) =>
      http.patch<UpdatedRequest>(`/requests/${id}`, changes).then((r) => r.data),
    onSuccess: (request) => refreshAround(request.id),
  })

export const useAddComment = () =>
  useMutation({
    mutationFn: ({ id, message, is_internal }: { id: number; message: string; is_internal: boolean }) =>
      http.post<RequestDetail>(`/requests/${id}/comments`, { message, is_internal }).then((r) => r.data),
    onSuccess: (detail) => {
      queryClient.setQueryData(requestKeys.detail(detail.id), detail)
      refreshAround()
    },
  })

/** Supervision: the same assignment or priority on several requests. */
export const useBulkUpdate = () =>
  useMutation({
    mutationFn: (input: { ids: number[]; assigned_agent_id?: number | null; priority?: RequestPriority }) =>
      http.post<{ updated: number }>('/requests/bulk', input).then((r) => r.data),
    onSuccess: () => refreshAround(),
  })

/** D04: contact message (anonymous needs honeypot + form_started_at; Turnstile when soft-limited). */
export type CreateContactInput = FormGuardPayload & {
  subject: string
  message: string
  contact_name?: string
  contact_email?: string
  service_id?: number
}

export type CreatedContact = {
  message: string
  reference: string
  status: RequestStatus
  request: RequestListItem
}

export const createContact = (input: CreateContactInput) =>
  http
    .post<CreatedContact>('/requests', {
      type: 'CONTACT' as const,
      subject: input.subject,
      message: input.message,
      contact_name: input.contact_name,
      contact_email: input.contact_email,
      service_id: input.service_id,
      website: input.website,
      form_started_at: input.form_started_at,
      turnstile_token: input.turnstile_token,
    })
    .then((r) => r.data)

export const useCreateContact = () =>
  useMutation({
    mutationFn: createContact,
    onSuccess: () => refreshAround(),
  })

/** F25: what the citizen suggested. The agent sets the real priority. */
export type UrgencyHint = 'LOW' | 'NORMAL' | 'HIGH'

export interface CreateIncidentInput {
  token: string
  subject: string
  message: string
  category: string
  district_id?: number
  location_label?: string
  latitude?: number
  longitude?: number
  urgency_hint: UrgencyHint
  attachment?: File
}

export const createIncident = (input: CreateIncidentInput) => {
  const headers = { Authorization: `Bearer ${input.token}` }
  if (input.attachment) {
    const form = new FormData()
    form.set('type', 'INCIDENT')
    form.set('subject', input.subject)
    form.set('message', input.message)
    form.set('category', input.category)
    if (input.district_id) form.set('district_id', String(input.district_id))
    if (input.location_label) form.set('location_label', input.location_label)
    if (input.latitude !== undefined) form.set('latitude', String(input.latitude))
    if (input.longitude !== undefined) form.set('longitude', String(input.longitude))
    form.set('data', JSON.stringify({ urgency_hint: input.urgency_hint }))
    form.set('attachment', input.attachment)
    return filmHttp.post<CreatedContact>('/requests', form, { headers }).then((r) => r.data)
  }
  return filmHttp
    .post<CreatedContact>(
      '/requests',
      {
        type: 'INCIDENT' as const,
        subject: input.subject,
        message: input.message,
        category: input.category,
        district_id: input.district_id,
        location_label: input.location_label,
        latitude: input.latitude,
        longitude: input.longitude,
        data: { urgency_hint: input.urgency_hint },
      },
      { headers },
    )
    .then((r) => r.data)
}

/** F25: the citizen's own report, polled with the film token (internal notes stay hidden by the API). */
export const fetchOwnRequest = (id: number, token: string) =>
  filmHttp.get<RequestDetail>(`/requests/${id}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.data)
