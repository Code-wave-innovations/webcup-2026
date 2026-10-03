import { Euler, MathUtils, Quaternion, Vector3 } from 'three'
import { clamp, damp } from '../../../lib/math'
import type { NovaPose } from '../behavior/novaBrain'
import { createFaceState, EXPRESSIONS, type Emotion, type FaceState } from '../face/faceState'
import type { NovaRig } from '../rig/createRig'
import type { BoneName } from '../rig/rigContract'

export interface LivingInput {
  pose: NovaPose
  /** world point Nova looks at (the visitor's cursor, a button, a district), or null */
  target: Vector3 | null
  /** character being spoken right now, drives the mouth */
  spokenChar: string | null
  /** loudness of what Nova hears (keystrokes), 0 → 1 */
  voice: number
  /** the cursor is over Nova: head tilted, eyes wide */
  curious: boolean
  /** the cursor is getting close (0 far → 1 touching): Nova leans towards it */
  attention: number
}

/** Critically damped (or springy) follow, frame-rate independent. */
class Spring {
  value = 0
  velocity = 0
  private readonly stiffness: number
  private readonly damping: number

  constructor(stiffness: number, damping: number) {
    this.stiffness = stiffness
    this.damping = damping
  }

  update(target: number, dt: number): number {
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      const force = (target - this.value) * this.stiffness - this.velocity * this.damping
      this.velocity += force * h
      this.value += this.velocity * h
    }
    return this.value
  }
}

const LOOK_YAW = MathUtils.degToRad(50)
const LOOK_PITCH = MathUtils.degToRad(25)
const VOWELS = /[aeiouyàâäéèêëîïôöûüù]/i
const LETTERS = /[a-zçœæ]/i
const ADDITIVE_BONES: readonly BoneName[] = ['Spine', 'Neck', 'Head', 'Chest', 'LeftShoulder', 'RightShoulder', 'Antenna']

/**
 * Everything that makes Nova look alive on top of its clips: breathing, blinks (sometimes double),
 * eye saccades that lead the head, a head that follows the target (40 % neck, 60 % head) on a
 * ~120 ms spring, an antenna that wobbles behind the head, hovering, and the face's expression,
 * mouth, thinking dots and listening waveform.
 */
export class LivingLayers {
  readonly face: FaceState = createFaceState()
  /** hover weight 0 → 1 (jets glow, shadow shrinks) */
  hover = 0
  hoverHeight = 0

  private readonly rig: NovaRig
  private readonly random: () => number
  private readonly base = new Map<BoneName, Quaternion>()
  private readonly yaw = new Spring(200, 28)
  private readonly pitch = new Spring(200, 28)
  private readonly antennaX = new Spring(90, 3.2)
  private readonly antennaZ = new Spring(90, 3.2)
  private lookWeight = 0
  private hoverVelocity = 0
  private curiosity = 0
  private attention = 0
  private nextBlink = 1.5
  private blinkStart = -10
  private doubleBlink = false
  private nextSaccade = 0.8
  private readonly saccade = { x: 0, y: 0 }
  private emotion: Emotion = 'neutral'
  private readonly scratch = { q: new Quaternion(), e: new Euler(), head: new Vector3(), target: new Vector3() }

  constructor(rig: NovaRig, random: () => number = Math.random) {
    this.rig = rig
    this.random = random
  }

  /** Puts back the bones' clip pose before the mixer runs (the additive layers must not accumulate). */
  beforeMixer(): void {
    for (const [bone, q] of this.base) this.rig.bones[bone]?.quaternion.copy(q)
  }

  update(dt: number, time: number, input: LivingInput): void {
    const { rig } = this
    for (const bone of ADDITIVE_BONES) {
      const node = rig.bones[bone]
      if (node) this.base.set(bone, (this.base.get(bone) ?? new Quaternion()).copy(node.quaternion))
    }
    this.updateExpression(dt, input.pose.emotion)
    this.updateEyes(dt, time, input.pose)
    this.updateHead(dt, time, input)
    this.updateMouth(dt, input)
    this.updateHover(dt, time, input.pose)
  }

  private add(bone: BoneName, x: number, y: number, z: number) {
    const node = this.rig.bones[bone]
    if (!node || !this.rig.space.has(bone)) return
    this.scratch.q.setFromEuler(this.scratch.e.set(x, y, z, 'YXZ'))
    this.rig.space.applyAdditive(bone, node, this.scratch.q)
  }

  private updateExpression(dt: number, emotion: Emotion) {
    if (emotion !== this.emotion) {
      this.emotion = emotion
      this.blinkStart = -10
      this.nextBlink = 0 // a change of feeling comes with a blink
    }
    const target = EXPRESSIONS[emotion]
    const k = damp(9, dt)
    const f = this.face
    f.happy += (target.happy - f.happy) * k
    f.sad += (target.sad - f.sad) * k
    f.angry += (target.angry - f.angry) * k
    f.surprised += (target.surprised - f.surprised) * k
    f.smile += (target.smile - f.smile) * k
    f.alert += (target.alert - f.alert) * damp(6, dt)
  }

  private updateEyes(dt: number, time: number, pose: NovaPose) {
    if (this.nextBlink <= 0) this.nextBlink = time
    if (time >= this.nextBlink) {
      this.blinkStart = time
      this.doubleBlink = this.random() < 0.15
      this.nextBlink = time + 2.5 + this.random() * 3.5
    }
    const blinkAt = (start: number) => {
      const t = time - start
      if (t < 0 || t > 0.16) return 1
      return t < 0.06 ? 1 - t / 0.06 : (t - 0.06) / 0.1
    }
    const open = Math.min(blinkAt(this.blinkStart), this.doubleBlink ? blinkAt(this.blinkStart + 0.22) : 1)
    const hidden = pose.eyesHidden
    const k = damp(14, dt)
    const f = this.face
    f.eyeOpen[0] += ((hidden === 'none' ? open : 0.06) - f.eyeOpen[0]) * (hidden === 'none' ? 1 : k)
    f.eyeOpen[1] += ((hidden === 'both' ? 0.06 : open) - f.eyeOpen[1]) * (hidden === 'both' ? k : 1)

    if (time >= this.nextSaccade) {
      this.saccade.x = (this.random() - 0.5) * 0.5
      this.saccade.y = (this.random() - 0.5) * 0.35
      this.nextSaccade = time + 0.6 + this.random() * 1.8
    }
  }

  private updateHead(dt: number, time: number, input: LivingInput) {
    const { pose, target } = input
    const { rig } = this
    let yawTarget = 0
    let pitchTarget = 0
    const head = rig.bones.Head
    if (pose.lookUp) {
      yawTarget = MathUtils.degToRad(16)
      pitchTarget = MathUtils.degToRad(-20)
    } else if (pose.lookAtTarget && target && head) {
      rig.root.updateMatrixWorld()
      const from = rig.root.worldToLocal(head.getWorldPosition(this.scratch.head))
      const to = rig.root.worldToLocal(this.scratch.target.copy(target)).sub(from)
      yawTarget = clamp(Math.atan2(to.x, to.z), -LOOK_YAW, LOOK_YAW)
      pitchTarget = clamp(-Math.atan2(to.y, Math.hypot(to.x, to.z)), -LOOK_PITCH, LOOK_PITCH)
    }
    const wantsLook = pose.lookUp || (pose.lookAtTarget && !!target)
    this.lookWeight += ((wantsLook ? 1 : 0) - this.lookWeight) * damp(6, dt)
    const yaw = this.yaw.update(yawTarget, dt) * this.lookWeight
    const pitch = this.pitch.update(pitchTarget, dt) * this.lookWeight

    // eyes lead the head: they point where the head is still turning to, plus small saccades
    this.face.look.x = clamp((yawTarget - this.yaw.value) * 2.4 + this.saccade.x, -1, 1)
    this.face.look.y = clamp(-(pitchTarget - this.pitch.value) * 2.4 + this.saccade.y, -1, 1)

    const breath = Math.sin((time * Math.PI * 2) / 3.6)
    this.add('Chest', MathUtils.degToRad(1.4) * breath, 0, 0)
    this.add('LeftShoulder', 0, 0, MathUtils.degToRad(1.2) * breath)
    this.add('RightShoulder', 0, 0, -MathUtils.degToRad(1.2) * breath)
    this.add('Neck', pitch * 0.4, yaw * 0.4, 0)
    this.curiosity += ((input.curious ? 1 : 0) - this.curiosity) * damp(7, dt)
    this.attention += (input.attention - this.attention) * damp(5, dt)
    this.face.surprised = Math.max(this.face.surprised, this.curiosity * 0.4, this.attention * 0.25)
    this.add('Spine', MathUtils.degToRad(5) * this.attention, 0, 0)
    this.add('Head', pitch * 0.6, yaw * 0.6, MathUtils.degToRad(3 * Math.sin(time * 0.7) * this.lookWeight + 13 * this.curiosity))

    // the antenna lags behind the head's turns and the body's hops
    const sway = this.antennaZ.update(-this.yaw.velocity * 0.05 + (pose.clip === 'brace' ? Math.sin(time * 40) * 0.08 : 0), dt)
    const nod = this.antennaX.update(this.pitch.velocity * 0.05 - this.hoverVelocity * 1.6, dt)
    this.add('Antenna', nod, 0, sway)
  }

  private updateHover(dt: number, time: number, pose: NovaPose) {
    this.hover += ((pose.floating ? 1 : 0) - this.hover) * damp(4, dt)
    const height = this.hover * (0.028 + Math.sin(time * 1.7) * 0.009)
    this.hoverVelocity = dt > 0 ? (height - this.hoverHeight) / dt : 0
    this.hoverHeight = height
    this.rig.root.position.y = height
  }

  private updateMouth(dt: number, { pose, spokenChar, voice }: LivingInput) {
    const f = this.face
    let open = 0
    if (pose.talking && spokenChar) open = VOWELS.test(spokenChar) ? 0.95 : LETTERS.test(spokenChar) ? 0.5 : 0.06
    f.mouth += (open - f.mouth) * damp(22, dt)
    f.thinking += ((pose.thinking ? 1 : 0) - f.thinking) * damp(8, dt)
    f.listening += ((pose.listening ? 1 : 0) - f.listening) * damp(8, dt)
    f.voice = Math.max(voice, f.voice - dt * 2.5)
  }
}
