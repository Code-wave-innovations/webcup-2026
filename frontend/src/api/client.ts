import axios, { type AxiosInstance } from 'axios'
import { toApiError } from './errors'
import { expireSession, useSessionStore } from './session'

// Fall back to the local backend when a variable is missing from .env
export const BaseUrl = import.meta.env.VITE_BASE_URL || 'http://localhost:9002'
export const rootApiUrl = import.meta.env.VITE_API_URL || `${BaseUrl}/api`
export const imgUrl = import.meta.env.VITE_IMG_URL || `${BaseUrl}/public/`

// Created once at module level so the instances are stable across renders
/** JSON requests */
export const http = axios.create({ baseURL: rootApiUrl, headers: { 'Content-Type': 'application/json' } })
/** multipart requests (file fields); axios lets the browser set the boundary */
export const fileHttp = axios.create({ baseURL: rootApiUrl, headers: { 'Content-Type': 'multipart/form-data' } })

function authorize(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    const token = useSessionStore.getState().token
    if (token) config.headers.set('Authorization', `Bearer ${token}`)
    return config
  })
  instance.interceptors.response.use(undefined, (error: unknown) => {
    const apiError = toApiError(error)
    // The token was refused (expired, account disabled): end the session everywhere.
    // A wrong password (401 INVALID_CREDENTIALS) is not an expired session.
    if (apiError.status === 401 && apiError.code === 'UNAUTHORIZED') expireSession()
    return Promise.reject(apiError)
  })
}

authorize(http)
authorize(fileHttp)
