import axios from 'axios'

export const faceApiUrl =
  import.meta.env.VITE_FACE_API_URL || 'http://localhost:9000'
export const faceApiKey = import.meta.env.VITE_FACE_API_KEY || ''

const faceHttp = axios.create({
  baseURL: faceApiUrl,
})

faceHttp.interceptors.request.use((config) => {
  if (faceApiKey) {
    config.headers['X-API-Key'] = faceApiKey
  }
  return config
})

export type FaceJson = {
  ok: boolean
  error?: string
  name?: string
  identity?: string | null
  label?: string
  score?: number
  verified?: boolean
  matched?: boolean
  committed?: boolean
  samples?: number
  required?: number
  message?: string
  liveness?: { ok: boolean; score: number; backend: string }
  emotion?: { label: string; score: number }
  bbox?: number[]
}

export async function faceHealth() {
  const { data } = await faceHttp.get('/health')
  return data
}

export async function enrollFrames(name: string, blobs: Blob[]) {
  const form = new FormData()
  form.append('name', name)
  blobs.forEach((blob, i) => form.append(`img${i}`, blob, `frame${i}.jpg`))
  const { data } = await faceHttp.post<FaceJson>('/enroll', form)
  return data
}

export async function identifyFrame(blob: Blob) {
  const form = new FormData()
  form.append('img', blob, 'probe.jpg')
  const { data } = await faceHttp.post<FaceJson>('/identify', form)
  return data
}

export async function verifyFrame(name: string, blob: Blob) {
  const form = new FormData()
  form.append('name', name)
  form.append('img', blob, 'probe.jpg')
  const { data } = await faceHttp.post<FaceJson>('/verify', form)
  return data
}

export async function emotionFrame(blob: Blob) {
  const form = new FormData()
  form.append('img', blob, 'probe.jpg')
  const { data } = await faceHttp.post<FaceJson>('/emotion', form)
  return data
}

export default function useFaceApi() {
  return {
    faceHttp,
    faceHealth,
    enrollFrames,
    identifyFrame,
    verifyFrame,
    emotionFrame,
  }
}
