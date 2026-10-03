import type { WebGLRenderer } from 'three'
import { matchesQuery, PHONE_QUERY } from '../../hooks/useMediaQuery'
import { debugParams } from '../director/debugParams'

/** What the device can afford, decided once when the renderer is created. */
export interface QualityProfile {
  /** phones and small GPUs: fewer vertices, towers, shuttles and pixels */
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

/**
 * Watches real frame times once the city is on screen and lowers the resolution, at most twice,
 * when the average frame is slower than 27 fps.
 */
export class AdaptiveResolution {
  scale = debugParams.quality ?? 1
  private steps = debugParams.quality === undefined ? 0 : MAX_STEPS
  private frames = 0
  private total = 0

  /** Returns true when `scale` changed and the canvas must be resized. */
  sample(frameSeconds: number): boolean {
    if (this.steps >= MAX_STEPS) return false
    this.frames++
    this.total += frameSeconds
    if (this.frames < SAMPLE_FRAMES) return false
    const slow = this.total / SAMPLE_FRAMES > SLOW_FRAME
    this.frames = 0
    this.total = 0
    if (!slow) {
      this.steps = MAX_STEPS
      return false
    }
    this.scale *= STEP
    this.steps++
    return true
  }
}
