import type { WebGLRenderer } from 'three'
import { matchesQuery, PHONE_QUERY } from '../../hooks/useMediaQuery'
import { debugParams } from '../director/debugParams'

/** What the device can afford, decided once when the renderer is created. */
export interface QualityProfile {
  /** phones and small GPUs: fewer vertices, towers, birds and pixels */
  light: boolean
  /** float render targets available: HDR pipeline with real highlights */
  hdr: boolean
  /** samples of multisample antialiasing on the scene buffer (0 = off) */
  msaa: number
  planetTextureSize: number
}

export function detectQuality(renderer: WebGLRenderer): QualityProfile {
  const light = matchesQuery(PHONE_QUERY) || renderer.capabilities.maxTextureSize < 8192
  const hdr = !debugParams.ldr && renderer.extensions.has('EXT_color_buffer_float')
  return {
    light,
    hdr,
    msaa: light || debugParams.noAntialias ? 0 : 4,
    planetTextureSize: debugParams.textureSize ?? (light ? 1024 : 2048),
  }
}

/**
 * Device pixel ratio for the canvas, capped so the number of shaded pixels stays within budget
 * (1.5 Mpx on light devices, 2.6 Mpx otherwise). `scale` drops when the frame rate cannot keep up.
 */
export function computePixelRatio(profile: QualityProfile, width: number, height: number, scale: number): number {
  let ratio = Math.min(window.devicePixelRatio || 1, profile.light ? 1.25 : 1.5) * scale
  const budget = profile.light ? 1.5e6 : 2.6e6
  const pixels = width * height * ratio * ratio
  if (pixels > budget) ratio *= Math.sqrt(budget / pixels)
  return ratio
}

const SAMPLE_FRAMES = 50
const SLOW_FRAME = 1 / 27
const STEP = 0.78
const MAX_STEPS = 2
/** Below this share of the frame spent on the GPU, fewer pixels would not make the frames faster. */
const GPU_BOUND = 0.6

/**
 * Watches real frame times once the city is on screen and lowers the resolution, at most twice,
 * when the average frame is slower than 27 fps. When the GPU time is known, it only does so if the
 * GPU is the bottleneck: frames capped elsewhere (headless compositor, a busy main thread, a 30 Hz
 * power-saving refresh) keep their sharpness.
 */
export class AdaptiveResolution {
  scale = debugParams.quality ?? 1
  private steps = debugParams.quality === undefined ? 0 : MAX_STEPS
  private frames = 0
  private total = 0
  private gpuFrames = 0
  private gpuTotal = 0

  /** Returns true when `scale` changed and the canvas must be resized. `gpuSeconds`: null when unknown. */
  sample(frameSeconds: number, gpuSeconds: number | null = null): boolean {
    if (this.steps >= MAX_STEPS) return false
    this.frames++
    this.total += frameSeconds
    if (gpuSeconds !== null) {
      this.gpuFrames++
      this.gpuTotal += gpuSeconds
    }
    if (this.frames < SAMPLE_FRAMES) return false
    const frame = this.total / SAMPLE_FRAMES
    const gpuBound = this.gpuFrames === 0 || this.gpuTotal / this.gpuFrames > frame * GPU_BOUND
    this.frames = this.total = this.gpuFrames = this.gpuTotal = 0
    if (frame <= SLOW_FRAME) {
      this.steps = MAX_STEPS
      return false
    }
    // slow, but not because of the pixels: keep watching without blurring the city
    if (!gpuBound) return false
    this.scale *= STEP
    this.steps++
    return true
  }
}

/**
 * GPU time of whole frames, from `EXT_disjoint_timer_query_webgl2` (Chrome and Edge on desktop).
 * Results arrive a few frames late; `seconds` stays null where the extension does not exist (Safari, Firefox).
 */
export class GpuFrameTimer {
  seconds: number | null = null
  private readonly ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null
  private active: WebGLQuery | null = null
  private pending: WebGLQuery[] = []
  private readonly gl: WebGL2RenderingContext

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    this.ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  }

  begin(): void {
    if (!this.ext || this.active || this.pending.length > 4) return
    this.active = this.gl.createQuery()
    if (this.active) this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.active)
  }

  end(): void {
    if (!this.ext || !this.active) return
    const { gl } = this
    gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    this.pending.push(this.active)
    this.active = null
    // a disjoint event (power state change, context switch) invalidates the results in flight
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean
    while (this.pending.length && gl.getQueryParameter(this.pending[0], gl.QUERY_RESULT_AVAILABLE)) {
      const query = this.pending.shift()!
      if (!disjoint) this.seconds = (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e9
      gl.deleteQuery(query)
    }
  }

  dispose(): void {
    if (this.active && this.ext) this.gl.endQuery(this.ext.TIME_ELAPSED_EXT)
    for (const query of [this.active, ...this.pending]) if (query) this.gl.deleteQuery(query)
    this.active = null
    this.pending = []
  }
}
