import { useMutation, useQuery } from '@tanstack/react-query'
import { http } from './client'
import { queryClient } from './queryClient'
import { serviceKeys } from './services'
import type { Procedure, ProcedureInput } from './types'

// D05 / D11: the procedures of a service (/api/procedures), written by admins

export const procedureKeys = {
  all: ['procedures'] as const,
  ofService: (serviceId: number) => [...procedureKeys.all, 'service', serviceId] as const,
}

export const useProcedures = (serviceId: number | null) =>
  useQuery({
    queryKey: procedureKeys.ofService(serviceId ?? 0),
    queryFn: () => http.get<Procedure[]>('/procedures', { params: { service_id: serviceId } }).then((r) => r.data),
    enabled: serviceId !== null,
  })

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: procedureKeys.all })
  void queryClient.invalidateQueries({ queryKey: serviceKeys.all })
}

export const useSaveProcedure = () =>
  useMutation({
    mutationFn: ({ id, ...input }: ProcedureInput & { id?: number }) =>
      (id ? http.patch<Procedure>(`/procedures/${id}`, input) : http.post<Procedure>('/procedures', input)).then((r) => r.data),
    onSuccess: refresh,
  })

export const useDeleteProcedure = () =>
  useMutation({
    mutationFn: (id: number) => http.delete(`/procedures/${id}`).then((r) => r.data),
    onSuccess: refresh,
  })
