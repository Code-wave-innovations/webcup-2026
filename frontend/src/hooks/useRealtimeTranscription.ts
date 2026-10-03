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

// Fin de phrase adaptative :
// - pauses courtes entre mots → on continue
// - peu de parole encore → silence plus long avant de couper (évite de tronquer)
// - phrase déjà longue → silence plus court (réactif)
const SPEECH_START_RMS = 0.018
const SPEECH_CONTINUE_RMS = 0.012 // hystérésis : plus bas une fois en parole
const MIN_SPEECH_MS = 200
const MAX_CHUNK_MS = 6000
const ENERGY_CHECK_INTERVAL_MS = 40
/** Silence toujours ignoré (respiration / entre-mots). */
const WORD_GAP_MS = 200
/** Silence requis si l’utterance est encore courte. */
const END_SILENCE_EARLY_MS = 420
/** Silence requis une fois qu’on a déjà parlé un moment. */
const END_SILENCE_LATE_MS = 320
/** À partir de cette durée de parole, on bascule vers END_SILENCE_LATE. */
const LONG_UTTERANCE_MS = 1200

function requiredEndSilenceMs(spokeForMs: number): number {
    if (spokeForMs <= 0) return END_SILENCE_EARLY_MS
    if (spokeForMs >= LONG_UTTERANCE_MS) return END_SILENCE_LATE_MS
    const t = spokeForMs / LONG_UTTERANCE_MS
    return Math.round(END_SILENCE_EARLY_MS + t * (END_SILENCE_LATE_MS - END_SILENCE_EARLY_MS))
}

export type RealtimeLanguage = 'fr' | 'en' | 'mg'

export const DEFAULT_LANGUAGE: RealtimeLanguage = 'fr'

export function useRealtimeTranscription(options?: {
    mode?: RealtimeMode
    language?: RealtimeLanguage
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
    const audioCtxRef = useRef<AudioContext | null>(null)
    const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const vadStateRef = useRef({ speaking: false, silenceStart: 0, speechStart: 0 })
    /** Maps utteranceId → raw STT text so a later refine can replace it in finalText. */
    const utteranceRawRef = useRef<Map<number, string>>(new Map())

    const stopRecorder = useCallback(() => {
        const recorder = recorderRef.current
        if (recorder && recorder.state !== 'inactive') {
            // stop() émet un dernier ondataavailable : c'est ce chunk (WebM complet
            // avec en-têtes EBML/Tracks) qui contient l'utterance envoyée au serveur.
            recorder.stop()
        }
    }, [])

    const startRecorder = useCallback((stream: MediaStream) => {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        if (recorderRef.current && recorderRef.current.state !== 'inactive') return

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : undefined
        const recorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream)
        recorderRef.current = recorder
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                ws.send(e.data)
            }
        }
        recorder.start()
    }, [])

    // Surveille l'énergie du micro : parole → silence prolongé = envoi immédiat.
    const startVad = useCallback(
        (stream: MediaStream) => {
            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 512
            audioCtx.createMediaStreamSource(stream).connect(analyser)

            const buf = new Float32Array(analyser.fftSize)
            vadStateRef.current = { speaking: false, silenceStart: 0, speechStart: 0 }
            vadTimerRef.current = setInterval(() => {
                if (recorderRef.current?.state !== 'recording') return
                analyser.getFloatTimeDomainData(buf)
                let sum = 0
                for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
                const rms = Math.sqrt(sum / buf.length)
                const now = Date.now()
                const state = vadStateRef.current
                const active =
                    rms >= (state.speaking ? SPEECH_CONTINUE_RMS : SPEECH_START_RMS)

                if (active) {
                    if (!state.speaking) {
                        state.speaking = true
                        state.speechStart = now
                    }
                    state.silenceStart = 0
                } else if (state.speaking) {
                    if (!state.silenceStart) state.silenceStart = now
                    const silentFor = now - state.silenceStart
                    const spokeFor = state.silenceStart - state.speechStart
                    if (silentFor < WORD_GAP_MS || spokeFor < MIN_SPEECH_MS) {
                        // Pause naturelle trop courte, ou utterance trop brève.
                    } else if (silentFor >= requiredEndSilenceMs(spokeFor)) {
                        state.speaking = false
                        state.silenceStart = 0
                        stopRecorder()
                        startRecorder(stream)
                    }
                }

                // Garde-fou : parole continue trop longue → on coupe quand même.
                if (state.speaking && now - state.speechStart >= MAX_CHUNK_MS) {
                    state.speaking = false
                    state.silenceStart = 0
                    state.speechStart = now
                    stopRecorder()
                    startRecorder(stream)
                }
            }, ENERGY_CHECK_INTERVAL_MS)
        },
        [startRecorder, stopRecorder],
    )

    const stopVad = useCallback(() => {
        if (vadTimerRef.current) {
            clearInterval(vadTimerRef.current)
            vadTimerRef.current = null
        }
        void audioCtxRef.current?.close().catch(() => undefined)
        audioCtxRef.current = null
    }, [])

    const stop = useCallback(() => {
        stopVad()
        stopRecorder()
        recorderRef.current = null
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        wsRef.current?.close(1000)
        wsRef.current = null
        setPartialText('')
        setStatus('idle')
    }, [stopRecorder, stopVad])

    const start = useCallback(async () => {
        if (wsRef.current) return
        setError(null)
        setPartialText('')
        setFinalText('')
        utteranceRawRef.current.clear()
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
                    const id = typeof msg.utteranceId === 'number' ? msg.utteranceId : undefined
                    if (id != null) utteranceRawRef.current.set(id, msg.text)
                    setFinalText((prev) => (prev ? `${prev} ` : '') + msg.text)
                    setPartialText('')
                } else if (msg.type === 'transcript.refined') {
                    const id = msg.utteranceId as number
                    const raw = utteranceRawRef.current.get(id)
                    if (raw && typeof msg.text === 'string') {
                        setFinalText((prev) => {
                            const idx = prev.lastIndexOf(raw)
                            if (idx === -1) return prev
                            return prev.slice(0, idx) + msg.text + prev.slice(idx + raw.length)
                        })
                        utteranceRawRef.current.set(id, msg.text)
                    }
                    setPartialText('')
                } else if (msg.type === 'error') {
                    setError({ code: msg.code, message: msg.message })
                    setStatus('error')
                }
            }

            ws.onclose = () => {
                if (wsRef.current === ws) {
                    wsRef.current = null
                    stopVad()
                    stopRecorder()
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
                    ...(optionsRef.current?.language
                        ? { languageHints: [optionsRef.current.language] }
                        : {}),
                    ...(optionsRef.current?.languageHints
                        ? { languageHints: optionsRef.current.languageHints }
                        : {}),
                    ...(optionsRef.current?.context ? { context: optionsRef.current.context } : {}),
                }),
            )

            // 4. Micro capture : MediaRecorder + VAD. Un chunk = une utterance,
            // envoyé dès que le silence suit la parole (plus de timer fixe de 5 s).
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream
            startRecorder(stream)
            startVad(stream)
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Impossible de démarrer la transcription'
            setError({ code: 'START_FAILED', message })
            setStatus('error')
            stop()
        }
    }, [startRecorder, startVad, stop, stopRecorder, stopVad])

    useEffect(() => {
        return () => {
            stopVad()
            stopRecorder()
            streamRef.current?.getTracks().forEach((t) => t.stop())
            wsRef.current?.close(1000)
        }
    }, [stopRecorder, stopVad])

    return { start, stop, status, partialText, finalText, error }
}

export default useRealtimeTranscription
