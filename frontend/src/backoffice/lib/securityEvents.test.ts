import { describe, expect, it } from 'vitest'
import { securityEventLook } from './securityEvents'

// Types the backend can emit today (not imported from the catalogue, so a missing title fails here)
const BACKEND_TYPES = [
  'login.locked',
  'login.ip_blocked',
  'login.disabled',
  'user.login_unlocked',
  'security.new_device',
  'security.device_forgotten',
  'security.sessions_revoked',
  'security.2fa_enabled',
  'security.2fa_disabled',
  'security.2fa_reset',
  'security.recovery_code_used',
  'security.passkey_added',
  'security.passkey_revoked',
  'security.password_changed',
  'security.password_reset',
  'security.face_enrolled',
]

describe('securityEventLook', () => {
  it('gives every backend type a French title', () => {
    for (const type of BACKEND_TYPES) {
      const look = securityEventLook(type)
      expect(look.title, type).not.toBe(type)
      expect(look.title).toMatch(/[A-Za-zÀ-ÿ]/)
    }
  })

  it('falls back to the raw code for an unknown type', () => {
    const look = securityEventLook('security.unknown_action')
    expect(look.title).toBe('security.unknown_action')
    expect(look.tone).toBe('neutral')
    expect(look.icon).toBe('info')
  })
})
