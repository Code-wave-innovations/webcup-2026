import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { dashboardKeys } from './dashboard'
import type { FormGuardPayload } from '../features/security/formGuard'
import { queryClient, REFRESH } from './queryClient'
import type { Paginated, RequestDetail, RequestListItem, RequestPriority, RequestStatus, RequestType, UpdatedRequest } from './types'

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

/** D04: anonymous contact message (requires honeypot + form_started_at; Turnstile when soft-limited). */
export type CreateContactInput = FormGuardPayload & {
  subject: string
  message: string
  contact_name: string
  contact_email: string
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

/** D16: a signed-in resident sends an incident report. */
export type CreateIncidentInput = {
  subject: string
  message: string
  category?: string
  district_id?: number
  location_label?: string
  data?: Record<string, unknown>
}

export const useCreateRequest = () =>
  useMutation({
    mutationFn: (input: CreateIncidentInput) =>
      http.post<CreatedContact>('/requests', { type: 'INCIDENT' as const, ...input }).then((r) => r.data),
    onSuccess: (created) => refreshAround(created.request.id),
  })
