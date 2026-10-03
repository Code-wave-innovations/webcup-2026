import { useEffect, useState, type RefObject } from 'react'
import type { WorkerRequest, WorkerResponse } from '../../workers/faceDetection.worker'

/** a face is looked for this often */
const SAMPLE_MS = 300
/** width of the frames sent to the detector (enough for a face at arm's length) */
const SAMPLE_WIDTH = 320
/** smallest face accepted, in % of the frame: the visitor sits in front of the camera */
const MIN_FACE = 16

export interface FacePresenceOptions {
  /** override the minimum face size (percent of frame width/height) */
  minFacePercent?: number
}

/**
 * Is a face in front of the camera? Detected in a worker so the film keeps its frame rate. `null` while
 * the detector loads, or when it cannot run: the scanner then captures on a timer instead.
 */
export function useFacePresence(
  videoRef: RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  options?: FacePresenceOptions,
): boolean | null {
  const [present, setPresent] = useState<boolean | null>(null)
  const minFace = options?.minFacePercent ?? MIN_FACE

  useEffect(() => {
    if (!enabled) return
    const worker = new Worker(new URL('../../workers/faceDetection.worker.ts', import.meta.url), { type: 'module' })
    let alive = true
    let ready = false
    let waiting = false
    let frameId = 0
    let timer = 0

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') {
        ready = true
        return
      }
      waiting = false
      if (message.type === 'result' && alive) {
        setPresent(!!message.box && message.box.width >= minFace && message.box.height >= minFace)
      }
    }

    const sample = async () => {
      const video = videoRef.current
      if (ready && !waiting && video && video.readyState >= 2 && video.videoWidth > 0) {
        waiting = true
        try {
          const resizeHeight = Math.round((SAMPLE_WIDTH * video.videoHeight) / video.videoWidth)
          const bitmap = await createImageBitmap(video, { resizeWidth: SAMPLE_WIDTH, resizeHeight })
          if (!alive) return bitmap.close()
          worker.postMessage({ type: 'detect', bitmap, frameId: ++frameId } satisfies WorkerRequest, [bitmap])
        } catch {
          waiting = false
        }
      }
      if (alive) timer = window.setTimeout(sample, SAMPLE_MS)
    }
    void sample()

    return () => {
      alive = false
      window.clearTimeout(timer)
      worker.terminate()
    }
  }, [enabled, videoRef, minFace])

  return enabled ? present : null
}
