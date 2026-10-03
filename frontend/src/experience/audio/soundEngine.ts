import { createRandom } from '../../lib/random'
import { CUES, chirp, type Cue, type Note } from './sounds'
import type { Emotion } from '../nova/face/faceState'

/** Continuous layers of the film, each faded in and out by the director. */
export type Bed = 'drone' | 'rumble' | 'wind'

const VOLUME = 0.55
const BED_GAIN: Record<Bed, number> = { drone: 0.11, rumble: 0.42, wind: 0.1 }
/** How fast a bed follows its level (seconds, time constant). */
const BED_SMOOTHING = 0.3

interface BedNodes {
  gain: GainNode
  filter: BiquadFilterNode
  /** filter frequency at tone 0 and 1 */
  range: readonly [number, number]
}

/**
 * Renders the score of `sounds.ts` with WebAudio. Lazy: no AudioContext exists before the visitor turns
 * the sound on (browsers only let a gesture start one), and it is suspended again when turned off.
 */
class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private white: AudioBuffer | null = null
  private beds = new Map<Bed, BedNodes>()
  private enabled = false
  private readonly random = createRandom(2140)

  setEnabled(on: boolean): void {
    this.enabled = on
    if (on) {
      const ctx = this.ensure()
      if (!ctx) return
      void ctx.resume()
      this.master!.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.05)
      // a context created without a gesture (sound remembered from a previous visit) waits for the first one
      if (ctx.state !== 'running') {
        const unlock = () => this.enabled && void ctx.resume()
        window.addEventListener('pointerdown', unlock, {
          once: true,
          capture: true,
        })
        window.addEventListener('keydown', unlock, {
          once: true,
          capture: true,
        })
      }
    } else if (this.ctx) {
      const ctx = this.ctx
      this.master!.gain.setTargetAtTime(0, ctx.currentTime, 0.06)
      window.setTimeout(() => !this.enabled && void ctx.suspend(), 400)
    }
  }

  /** The tab is hidden: nothing should keep humming in the background. */
  pause(hidden: boolean): void {
    if (!this.ctx || !this.enabled) return
    void (hidden ? this.ctx.suspend() : this.ctx.resume())
  }

  cue(name: Cue): void {
    this.play(CUES[name])
  }

  chirp(emotion: Emotion): void {
    this.play(chirp(emotion, this.random))
  }

  play(notes: readonly Note[]): void {
    const ctx = this.ctx
    if (!this.enabled || !ctx || ctx.state !== 'running') return
    const start = ctx.currentTime + 0.005
    for (const note of notes) {
      const t = start + note.at
      const env = ctx.createGain()
      env.gain.setValueAtTime(0, t)
      env.gain.linearRampToValueAtTime(note.gain, t + Math.min(0.008, note.dur * 0.2))
      env.gain.exponentialRampToValueAtTime(0.0001, t + note.dur)
      env.connect(this.master!)
      let source: AudioScheduledSourceNode
      if (note.kind === 'tone') {
        const osc = ctx.createOscillator()
        osc.type = note.wave
        osc.frequency.setValueAtTime(note.freq, t)
        if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, t + note.dur)
        osc.connect(env)
        osc.start(t)
        source = osc
      } else {
        const noise = ctx.createBufferSource()
        noise.buffer = this.white
        const band = ctx.createBiquadFilter()
        band.type = 'bandpass'
        band.Q.value = note.q
        band.frequency.setValueAtTime(note.freq, t)
        if (note.to) band.frequency.exponentialRampToValueAtTime(note.to, t + note.dur)
        noise.connect(band).connect(env)
        // each hiss reads its own slice of the noise
        noise.start(t, this.random())
        source = noise
      }
      source.stop(t + note.dur + 0.03)
      source.onended = () => env.disconnect()
    }
  }

  /** Fades a bed towards `level` (0 → 1); `tone` (0 → 1) opens its filter. */
  setBed(bed: Bed, level: number, tone = 0): void {
    const nodes = this.beds.get(bed)
    const ctx = this.ctx
    if (!nodes || !ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    nodes.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * BED_GAIN[bed], now, BED_SMOOTHING)
    nodes.filter.frequency.setTargetAtTime(nodes.range[0] + (nodes.range[1] - nodes.range[0]) * tone, now, BED_SMOOTHING)
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Context) return null
    const ctx = new Context()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -16
    limiter.ratio.value = 6
    this.master.connect(limiter).connect(ctx.destination)
    this.white = noiseBuffer(ctx, false)
    this.buildBeds(ctx)
    return ctx
  }

  private buildBeds(ctx: AudioContext): void {
    const brown = noiseBuffer(ctx, true)
    const layer = (bed: Bed, type: BiquadFilterType, range: readonly [number, number], q: number) => {
      const filter = ctx.createBiquadFilter()
      filter.type = type
      filter.frequency.value = range[0]
      filter.Q.value = q
      const gain = ctx.createGain()
      gain.gain.value = 0
      filter.connect(gain).connect(this.master!)
      this.beds.set(bed, { gain, filter, range })
      return filter
    }
    const loop = (buffer: AudioBuffer, into: AudioNode) => {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(into)
      source.start()
    }
    const wobble = (param: AudioParam, rate: number, depth: number) => {
      const lfo = ctx.createOscillator()
      const amount = ctx.createGain()
      lfo.frequency.value = rate
      amount.gain.value = depth
      lfo.connect(amount).connect(param)
      lfo.start()
    }

    // the ship in orbit: two detuned low saws beating slowly under a breathing low-pass
    const drone = layer('drone', 'lowpass', [240, 420], 0.8)
    for (const freq of [55, 55.37, 82.6]) {
      const osc = ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.connect(drone)
      osc.start()
    }
    wobble(drone.frequency, 0.07, 90)
    // the re-entry: brown noise, its low-pass opening with the plasma
    loop(brown, layer('rumble', 'lowpass', [110, 700], 0.6))
    // the air of the descent and of the city: a band of noise sweeping slowly
    const wind = layer('wind', 'bandpass', [520, 1400], 0.7)
    loop(this.white!, wind)
    wobble(wind.frequency, 0.11, 260)
  }
}

/** Two seconds of white (or brown, integrated) noise, looped by the beds and sliced by the hisses. */
function noiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  const random = createRandom(brown ? 7 : 3)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = random() * 2 - 1
    last = brown ? (last + 0.02 * white) / 1.02 : white
    data[i] = brown ? last * 3.5 : white
  }
  return buffer
}

/** The one sound engine of the app. */
export const soundEngine = new SoundEngine()
