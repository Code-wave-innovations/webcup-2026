import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient } from './queryClient'
import type { Appointment, AppointmentSlot, AppointmentStatus, BookingInput, Paginated } from './types'

// F39 / F40: slots to book (public), the citizen's appointments, and the agent's agenda

export const appointmentKeys = {
  all: ['appointments'] as const,
  slots: (serviceId: number | null) => [...appointmentKeys.all, 'slots', serviceId] as const,
  staffSlots: (filters: { from: string; to: string; agent_id?: number }) => [...appointmentKeys.all, 'staff-slots', filters] as const,
  list: (filters: AppointmentFilters) => [...appointmentKeys.all, 'list', filters] as const,
  detail: (id: number) => [...appointmentKeys.all, 'detail', id] as const,
}

export interface AppointmentFilters {
  scope?: 'upcoming' | 'past' | 'all'
  status?: AppointmentStatus
  /** staff: the slots assigned to me */
  mine?: boolean
  from?: string
  to?: string
  /** staff: one citizen's appointments */
  citizen_id?: number
  limit?: number
}

/** The next 14 days of bookable slots (only those with places left), or of one service */
export const useSlots = (serviceId: number | null, enabled = true) =>
  useQuery({
    queryKey: appointmentKeys.slots(serviceId),
    queryFn: () => http.get<AppointmentSlot[]>('/appointments/slots', { params: { service_id: serviceId ?? undefined } }).then((r) => r.data),
    enabled,
    // places go fast: a slot taken by someone else disappears within half a minute
    refetchInterval: 30_000,
  })

/** Staff: every slot of a period, full and inactive ones included, for the agenda */
export const useStaffSlots = (filters: { from: string; to: string; agent_id?: number }) =>
  useQuery({
    queryKey: appointmentKeys.staffSlots(filters),
    queryFn: () => http.get<AppointmentSlot[]>('/appointments/slots', { params: { all: true, ...filters } }).then((r) => r.data),
    refetchInterval: 60_000,
  })

export const useAppointments = (filters: AppointmentFilters, enabled = true) =>
  useQuery({
    queryKey: appointmentKeys.list(filters),
    queryFn: () => http.get<Paginated<Appointment>>('/appointments', { params: { limit: 50, ...filters } }).then((r) => r.data),
    enabled,
  })

export const useAppointment = (id: number | null) =>
  useQuery({
    queryKey: appointmentKeys.detail(id ?? 0),
    queryFn: () => http.get<Appointment>(`/appointments/${id}`).then((r) => r.data),
    enabled: id !== null,
  })

const refresh = () => queryClient.invalidateQueries({ queryKey: appointmentKeys.all })

export const useBookAppointment = () =>
  useMutation({
    mutationFn: (input: BookingInput) =>
      http.post<{ message: string; reference: string; appointment: Appointment }>('/appointments', input).then((r) => r.data),
    onSettled: refresh,
  })

export const useCancelAppointment = () =>
  useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => http.post<Appointment>(`/appointments/${id}/cancel`, { reason }).then((r) => r.data),
    onSuccess: refresh,
  })

/** F40: when to be reminded; null for no reminder */
export const useUpdateReminder = () =>
  useMutation({
    mutationFn: ({ id, offset }: { id: number; offset: number | null }) =>
      http.patch<Appointment>(`/appointments/${id}/reminder`, { reminder_offset_minutes: offset }).then((r) => r.data),
    onSuccess: refresh,
  })

/** Staff: honoured, no-show, notes */
export const useUpdateAppointment = () =>
  useMutation({
    mutationFn: ({ id, ...changes }: { id: number; status?: AppointmentStatus; agent_notes?: string | null }) =>
      http.patch<Appointment>(`/appointments/${id}`, changes).then((r) => r.data),
    onSuccess: refresh,
  })

/**
 * The .ics file needs the session (a plain link would not send it): fetched as a blob, then saved.
 * Its alarm matches the reminder chosen in the app.
 */
export async function downloadCalendar(appointment: Pick<Appointment, 'id' | 'reference'>): Promise<void> {
  const { data } = await http.get<Blob>(`/appointments/${appointment.id}/ics`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const link = document.createElement('a')
  link.href = url
  link.download = `${appointment.reference}.ics`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
