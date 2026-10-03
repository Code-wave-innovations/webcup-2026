import { describe, expect, it } from 'vitest'
import { AdaptiveResolution } from './quality'

const feed = (adaptive: AdaptiveResolution, frames: number, frame: number, gpu: number | null) => {
  let changed = false
  for (let i = 0; i < frames; i++) changed = adaptive.sample(frame, gpu) || changed
  return changed
}

describe('AdaptiveResolution', () => {
  it('keeps full resolution when the frames are fast, and stops watching', () => {
    const adaptive = new AdaptiveResolution()
    expect(feed(adaptive, 50, 1 / 60, 0.008)).toBe(false)
    expect(feed(adaptive, 200, 1 / 15, 0.06)).toBe(false)
    expect(adaptive.scale).toBe(1)
  })

  it('lowers the resolution, at most twice, when the GPU cannot keep up', () => {
    const adaptive = new AdaptiveResolution()
    expect(feed(adaptive, 50, 1 / 20, 0.045)).toBe(true)
    feed(adaptive, 500, 1 / 20, 0.045)
    expect(adaptive.scale).toBeCloseTo(0.78 * 0.78)
  })

  it('keeps its sharpness when slow frames are not the GPU’s fault', () => {
    const adaptive = new AdaptiveResolution()
    expect(feed(adaptive, 300, 1 / 26, 0.006)).toBe(false)
    expect(adaptive.scale).toBe(1)
  })

  it('falls back on frame times alone when the GPU time is unknown', () => {
    const adaptive = new AdaptiveResolution()
    expect(feed(adaptive, 50, 1 / 20, null)).toBe(true)
  })
})
