import axios, { type AxiosInstance } from 'axios'
import { toApiError } from './errors'
import { authTokenForSpace, expireSession } from './session'

// Fall back to the local backend when a variable is missing from .env
export const BaseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:9002'
export const rootApiUrl = import.meta.env.VITE_API_URL || `${BaseUrl}/api`
export const imgUrl = import.meta.env.VITE_IMG_URL || `${BaseUrl}/public/`

// Created once at module level so the instances are stable across renders
/** JSON requests */
export const http = axios.create({ baseURL: rootApiUrl, headers: { 'Content-Type': 'application/json' } })
/** multipart requests (file fields); axios lets the browser set the boundary */
export const fileHttp = axios.create({ baseURL: rootApiUrl, headers: { 'Content-Type': 'multipart/form-data' } })

const DEVICE_KEY = 'nova-device'

/**
 * F54: a random id for this browser, so the server can tell a new device from a known one.
 * It is not a proof of identity; cleared storage simply makes a "new" device.
 */
function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

function authorize(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    // Citizen film → nova-auth-citizen; /agent|/admin → nova-auth-staff.
    const token = authTokenForSpace()
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    else config.headers.delete('Authorization')
    const device = deviceId()
    if (device) config.headers.set('X-Device-Id', device)
    return config
  })
  instance.interceptors.response.use(undefined, (error: unknown) => {
    const apiError = toApiError(error)
    const sentAuth = Boolean(axios.isAxiosError(error) && error.config?.headers?.Authorization)
    if (sentAuth) {
      // The token was refused (expired, account disabled): end that space’s session.
      // A wrong password (401 INVALID_CREDENTIALS) is not an expired session.
      if (apiError.status === 401 && apiError.code === 'UNAUTHORIZED') expireSession('expired')
      if (apiError.status === 401 && apiError.code === 'SESSION_REVOKED') expireSession('revoked')
    }
    return Promise.reject(apiError)
  })
}

authorize(http)
authorize(fileHttp)
