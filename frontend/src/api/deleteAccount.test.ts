import { beforeEach, describe, expect, it, vi } from 'vitest'

const deleteMock = vi.fn()

vi.mock('./client', () => ({
  http: {
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}))

import { deleteMyAccount } from './deleteAccount'

beforeEach(() => {
  deleteMock.mockReset()
  deleteMock.mockResolvedValue({ data: { deleted: true, message: 'ok' } })
})

describe('deleteMyAccount', () => {
  it('DELETEs /me with password and confirm: true', async () => {
    await expect(deleteMyAccount({ password: 'NovaTerra2026!', confirm: true })).resolves.toEqual({
      deleted: true,
      message: 'ok',
    })
    expect(deleteMock).toHaveBeenCalledWith('/me', { data: { password: 'NovaTerra2026!', confirm: true } })
  })
})
