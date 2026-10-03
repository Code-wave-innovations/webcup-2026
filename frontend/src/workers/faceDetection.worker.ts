import * as faceapi from '@vladmandic/face-api'

export type WorkerRequest = {
    type: 'detect'
    bitmap: ImageBitmap
    frameId: number
}

export type WorkerResponse =
    | {
        type: 'ready'
    }
    | {
        type: 'result'
        frameId: number
        /** Position en % de la vidéo affichée (miroir déjà appliqué). */
        box: { left: number; top: number; width: number; height: number } | null
        score: number
    }
    | {
        type: 'error'
        message: string
    }

const MODEL_URL =
    'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/'

let options: faceapi.TinyFaceDetectorOptions | null = null

async function boot() {
    await faceapi.nets.tinyFaceDetector.load(MODEL_URL)
    // inputSize plus grand que le fallback main-thread : le coût ne pénalise plus l'UI.
    options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.4,
    })
    self.postMessage({ type: 'ready' } satisfies WorkerResponse)
}

void boot().catch((err: unknown) => {
    self.postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : 'worker boot failed',
    } satisfies WorkerResponse)
})

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    if (e.data.type !== 'detect' || !options) return
    const { bitmap, frameId } = e.data
    const vw = bitmap.width
    const vh = bitmap.height
    // ImageBitmap n'est pas un TNetInput : conversion RGBA → tenseur RGB.
    const ctx = new OffscreenCanvas(vw, vh).getContext('2d')
    ctx?.drawImage(bitmap, 0, 0)
    bitmap.close()
    if (!ctx) return
    const rgba = ctx.getImageData(0, 0, vw, vh)
    const rgb = new Float32Array(vw * vh * 3)
    for (let i = 0, j = 0; i < rgba.data.length; i += 4, j += 3) {
        rgb[j] = rgba.data[i]
        rgb[j + 1] = rgba.data[i + 1]
        rgb[j + 2] = rgba.data[i + 2]
    }
    const input = faceapi.tf.tensor3d(rgb, [vh, vw, 3], 'float32')
    try {
        const det = await faceapi.detectSingleFace(input, options)
        input.dispose()
        let box: { left: number; top: number; width: number; height: number } | null = null
        if (det && det.score > 0.35) {
            const { x, y, width, height } = det.box
            box = {
                // Le bitmap n'est pas le miroir : la vidéo affichée l'est, on inverse x.
                left: ((vw - x - width) / vw) * 100,
                top: (y / vh) * 100,
                width: (width / vw) * 100,
                height: (height / vh) * 100,
            }
        }
        self.postMessage({ type: 'result', frameId, box, score: det?.score ?? 0 } satisfies WorkerResponse)
    } catch (err: unknown) {
        input.dispose()
        self.postMessage({
            type: 'error',
            message: err instanceof Error ? err.message : 'detect failed',
        } satisfies WorkerResponse)
    }
}
