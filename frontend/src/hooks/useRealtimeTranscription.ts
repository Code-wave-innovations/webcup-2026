import { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'

export const sttApiUrl = import.meta.env.VITE_STT_API_URL || 'http://localhost:9100'

export type RealtimeMode = 'FAST' | 'BALANCED' | 'ACCURATE'

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'closed'
  | 'error'

export type RealtimeError = { code: string; message: string }

const CHUNK_INTERVAL_MS = 5000

export function useRealtimeTranscription(options?: {
  mode?: RealtimeMode
  languageHints?: string[]
  context?: { domain?: string; keywords?: string[] }
}) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [partialText, setPartialText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState<RealtimeError | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    wsRef.current?.close(1000)
    wsRef.current = null
    setPartialText('')
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (wsRef.current) return
    setError(null)
    setPartialText('')
    setFinalText('')
    setStatus('connecting')

    try {
      // 1. Ephemeral token (no STT secret in the browser: the server issues it).
      const { data: tokenData } = await axios.post<{ token: string; wsUrl: string }>(
        `${sttApiUrl}/v1/realtime/tokens`,
      )

      // 2. WebSocket to the STT service.
      const wsUrl = `${sttApiUrl.replace(/^http/, 'ws')}${tokenData.wsUrl}?token=${encodeURIComponent(tokenData.token)}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onerror = () => {
        setError({ code: 'WS_ERROR', message: 'Connexion WebSocket impossible' })
        setStatus('error')
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string)
        if (msg.type === 'session.ready') setStatus('listening')
        else if (msg.type === 'transcript.partial') setPartialText(msg.text)
        else if (msg.type === 'transcript.final') {
          setFinalText((prev) => (prev ? `${prev} ` : '') + msg.text)
          setPartialText('')
        } else if (msg.type === 'error') {
          setError({ code: msg.code, message: msg.message })
          setStatus('error')
        }
      }

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
          if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop()
          }
          recorderRef.current = null
          streamRef.current?.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          setStatus((prev) => (prev === 'error' ? prev : 'closed'))
        }
      }

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = () => reject(new Error('WebSocket open failed'))
      })

      // 3. Session configuration.
      ws.send(
        JSON.stringify({
          type: 'session.start',
          mode: optionsRef.current?.mode ?? 'BALANCED',
          ...(optionsRef.current?.languageHints
            ? { languageHints: optionsRef.current.languageHints }
            : {}),
          ...(optionsRef.current?.context ? { context: optionsRef.current.context } : {}),
        }),
      )

      // 4. Micro capture: MediaRecorder emits webm/opus chunks (~5 s each).
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data) // binary audio chunk
        }
      }
      recorder.start(CHUNK_INTERVAL_MS)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Impossible de démarrer la transcription'
      setError({ code: 'START_FAILED', message })
      setStatus('error')
      stop()
    }
  }, [stop])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      wsRef.current?.close(1000)
    }
  }, [])

  return { start, stop, status, partialText, finalText, error }
}

export default useRealtimeTranscription
