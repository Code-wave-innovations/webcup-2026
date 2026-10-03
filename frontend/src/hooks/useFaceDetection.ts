import { useEffect, useRef, useState } from 'react'
import * as faceapi from '@vladmandic/face-api'

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
        const pending = (async () => {
            // WebGL est refusé dans cette page (contexte indisponible). Le CPU lit la caméra quand même.
            const tf = faceapi.tf as typeof faceapi.tf & {
                setBackend: (backend: string) => Promise<boolean>
                ready: () => Promise<void>
            }
            await tf.setBackend('cpu')
            await tf.ready()
            await faceapi.nets.tinyFaceDetector.load(MODEL_URL)
        })()
        modelPromise = pending.catch((error: unknown) => {
            modelPromise = null
            throw error
        })
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

    useEffect(() => {
        if (!enabled) return
        cancelledRef.current = false
        let timer: number | null = null

        function push(next: FaceBox | null) {
            if (isStable(prevRef.current, next)) return
            prevRef.current = next
            setBbox(next)
            setFaceDetected(next !== null)
        }

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.5,
        })

        async function tick() {
            if (cancelledRef.current) return
            const video = videoRef.current
            if (video && video.readyState >= 2 && video.videoWidth > 0) {
                try {
                    const det = await faceapi.detectSingleFace(video, options)
                    if (cancelledRef.current) return
                    const bigEnough =
                        det !== undefined &&
                        det.box.width / video.videoWidth >= 0.18 &&
                        det.box.height / video.videoHeight >= 0.18
                    if (det && det.score > 0.5 && bigEnough) {
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
            if (!cancelledRef.current) timer = window.setTimeout(tick, 280)
        }

        void loadTinyFaceModel()
            .then(() => {
                if (cancelledRef.current) return
                setModelReady(true)
                void tick()
            })
            .catch(() => {
                if (!cancelledRef.current) setModelReady(false)
            })

        return () => {
            cancelledRef.current = true
            if (timer !== null) window.clearTimeout(timer)
        }
    }, [enabled, videoRef])

    return { faceDetected, bbox, modelReady }
}

export default useFaceDetection
