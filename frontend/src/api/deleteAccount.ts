import { http } from './client'

/** F33: citizen deletes own account — password re-entry required. */
export function deleteMyAccount(input: { password: string; confirm: true }) {
  return http.delete<{ deleted: true; message: string }>('/me', { data: input }).then((r) => r.data)
}
