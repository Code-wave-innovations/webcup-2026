import { useEffect, useRef, useState } from 'react'
import * as faceapi from '@vladmandic/face-api'
import type { WorkerResponse } from '../workers/faceDetection.worker'

export type FaceBox = {
    /** Position en % de la vidéo affichée (miroir déjà appliqué). */
    left: number
    top: number
    width: number
    height: number
}

const MODEL_URL =
    'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/'

let modelPromise: Promise<void> | null = null

function loadTinyFaceModel(): Promise<void> {
    if (!modelPromise) {
        modelPromise = faceapi.nets.tinyFaceDetector.load(MODEL_URL)
    }
    return modelPromise
}

function isStable(prev: FaceBox | null, next: FaceBox | null): boolean {
    if (!prev || !next) return prev === next
    return (
        Math.abs(prev.left - next.left) < 1 &&
        Math.abs(prev.top - next.top) < 1 &&
        Math.abs(prev.width - next.width) < 1 &&
        Math.abs(prev.height - next.height) < 1
    )
}

export function useFaceDetection(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    { enabled }: { enabled: boolean },
) {
    const [faceDetected, setFaceDetected] = useState(false)
    const [bbox, setBbox] = useState<FaceBox | null>(null)
    const [modelReady, setModelReady] = useState(false)
    const cancelledRef = useRef(false)
    const prevRef = useRef<FaceBox | null>(null)
    const busyRef = useRef(false)
    const workerRef = useRef<Worker | null>(null)
    const frameIdRef = useRef(0)

    useEffect(() => {
        if (!enabled) return
        cancelledRef.current = false

        function push(next: FaceBox | null) {
            if (isStable(prevRef.current, next)) return
            prevRef.current = next
            setBbox(next)
            setFaceDetected(next !== null)
        }

        let worker: Worker | null = null
        let fallbackLoop: number | null = null
        const cancelled = () => cancelledRef.current

        async function bootWorker() {
            try {
                worker = new Worker(
                    new URL('../workers/faceDetection.worker.ts', import.meta.url),
                    { type: 'module' },
                )
            } catch {
                return startFallback()
            }
            workerRef.current = worker

            worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
                if (cancelled()) return
                const msg = e.data
                if (msg.type === 'ready') {
                    setModelReady(true)
                    busyRef.current = false
                    captureLoop()
                } else if (msg.type === 'result') {
                    busyRef.current = false
                    push(msg.box)
                } else {
                    busyRef.current = false
                }
            }
            worker.onerror = () => {
                if (!cancelled()) startFallback()
            }
        }

        async function captureLoop() {
            if (cancelled() || busyRef.current) return
            const video = videoRef.current
            if (!video || video.readyState < 2 || video.videoWidth === 0) {
                setTimeout(captureLoop, 250)
                return
            }
            busyRef.current = true
            const frameId = ++frameIdRef.current
            try {
                const bitmap = await createImageBitmap(video)
                if (cancelled()) {
                    bitmap.close()
                    return
                }
                worker?.postMessage({ type: 'detect', bitmap, frameId }, [bitmap])
            } catch {
                busyRef.current = false
                setTimeout(captureLoop, 250)
            }
        }

        async function startFallback() {
            if (cancelled()) return
            try {
                await loadTinyFaceModel()
                if (cancelled()) return
                setModelReady(true)
            } catch {
                return
            }
            const options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 160,
                scoreThreshold: 0.4,
            })

            async function tick() {
                if (cancelled()) return
                const video = videoRef.current
                if (video && video.readyState >= 2 && video.videoWidth > 0) {
                    try {
                        const det = await faceapi.detectSingleFace(video, options)
                        if (cancelled()) return
                        if (det && det.score > 0.35) {
                            const { x, y, width, height } = det.box
                            const vw = video.videoWidth
                            const vh = video.videoHeight
                            push({
                                left: ((vw - x - width) / vw) * 100,
                                top: (y / vh) * 100,
                                width: (width / vw) * 100,
                                height: (height / vh) * 100,
                            })
                        } else {
                            push(null)
                        }
                    } catch {
                        // frame illisible, on retente au prochain tick
                    }
                }
                fallbackLoop = window.setTimeout(tick, 250)
            }

            void tick()
        }

        void bootWorker()

        return () => {
            cancelledRef.current = true
            workerRef.current?.terminate()
            workerRef.current = null
            if (fallbackLoop !== null) clearTimeout(fallbackLoop)
        }
    }, [enabled, videoRef])

    return { faceDetected, bbox, modelReady }
}

export default useFaceDetection
