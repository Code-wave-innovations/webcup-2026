import { useQuery } from '@tanstack/react-query'
import { http } from './client'
import type { District } from './types'

// The five districts of Terra Nova (GET /api/districts, public)

export const districtKeys = { all: ['districts'] as const }

export const useDistricts = () =>
  useQuery({
    queryKey: districtKeys.all,
    queryFn: () => http.get<District[]>('/districts').then((r) => r.data),
    staleTime: 60 * 60_000,
  })
