import { AnimationMixer, LoopOnce, LoopRepeat, type AnimationAction } from 'three'
import type { NovaRig } from '../rig/createRig'
import type { ClipName } from '../rig/rigContract'

/** Crossfade per destination: hands reach the eyes in 450 ms, a gesture starts briskly. */
const FADE: Partial<Record<ClipName, number>> = { coverEyes: 0.45, peek: 0.35, brace: 0.3, think: 0.4, listen: 0.4, walk: 0.3, crouch: 0.18, fly: 0.45, land: 0.06 }
const DEFAULT_FADE = 0.25

/**
 * Plays one clip at a time on the rig and crossfades between them. One-shot clips hold their last frame
 * and report their end (the brain then returns to the posture underneath).
 */
export class NovaAnimator {
  readonly mixer: AnimationMixer
  private readonly actions = new Map<ClipName, AnimationAction>()
  private current: { clip: ClipName; key: number; action: AnimationAction } | null = null

  constructor(rig: NovaRig, onOnceFinished: (key: number) => void) {
    this.mixer = new AnimationMixer(rig.root)
    for (const [name, clip] of Object.entries(rig.clips) as Array<[ClipName, NovaRig['clips'][ClipName]]>) {
      this.actions.set(name, this.mixer.clipAction(clip))
    }
    this.mixer.addEventListener('finished', (event) => {
      if (this.current && event.action === this.current.action) onOnceFinished(this.current.key)
    })
  }

  /** Switches to `clip` (no-op if already playing it with the same key). */
  play(clip: ClipName, once: boolean, key: number): void {
    if (this.current && this.current.clip === clip && this.current.key === key) return
    const action = this.actions.get(clip)
    if (!action) return
    const fade = this.current ? (FADE[clip] ?? DEFAULT_FADE) : 0
    const previous = this.current?.action
    action.reset()
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity)
    action.clampWhenFinished = once
    action.setEffectiveTimeScale(1).setEffectiveWeight(1)
    action.play()
    if (previous && previous !== action) {
      action.crossFadeFrom(previous, fade, false)
    } else if (fade > 0) {
      action.fadeIn(fade)
    }
    this.current = { clip, key, action }
  }

  /** Playback speed of the current looping clip (the walk follows the scroll so the feet do not slide). */
  setPace(timeScale: number): void {
    if (this.current && this.current.action.loop === LoopRepeat) this.current.action.setEffectiveTimeScale(timeScale)
  }

  update(dt: number): void {
    this.mixer.update(dt)
  }

  dispose(): void {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.mixer.getRoot())
  }
}
