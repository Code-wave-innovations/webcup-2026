import { AnimationClip, Euler, MathUtils, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type KeyframeTrack, type Object3D } from 'three'
import type { RigSpace } from '../rig/RigSpace'
import type { BoneName } from '../rig/rigContract'
import type { ClipDefinition, PoseKey, Rotation } from './poseLibrary'

const FPS = 30
const ZERO: Rotation = [0, 0, 0]

/** Value of a bone at a key: its own rotation, or the last one given before it (holds a pose between keys). */
function rotationAt(keys: readonly PoseKey[], index: number, bone: BoneName): Rotation {
  for (let i = index; i >= 0; i--) {
    const r = keys[i].bones[bone]
    if (r) return r
  }
  return ZERO
}

function hipsAt(keys: readonly PoseKey[], index: number): readonly [number, number, number] {
  for (let i = index; i >= 0; i--) {
    const h = keys[i].hips
    if (h) return h
  }
  return ZERO
}

const toQuaternion = ([x, y, z]: Rotation, out: Quaternion) =>
  out.setFromEuler(new Euler(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z), 'YXZ'))

/**
 * Bakes a gesture into an AnimationClip on a given rig: the keys are eased (smoothstep between keys,
 * so motion settles instead of ticking like a metronome), resampled at 30 fps and converted from the
 * character's frame into each bone's local frame.
 */
export function buildClip(name: string, definition: ClipDefinition, space: RigSpace, bones: Partial<Record<BoneName, Object3D>>): AnimationClip {
  const { keys, duration } = definition
  const frames = Math.max(2, Math.round(duration * FPS) + 1)
  const times = Float32Array.from({ length: frames }, (_, i) => (i / (frames - 1)) * duration)
  const segmentAt = (t: number) => {
    let i = 0
    while (i < keys.length - 2 && t > keys[i + 1].t) i++
    const span = keys[i + 1].t - keys[i].t
    const f = span > 0 ? MathUtils.clamp((t - keys[i].t) / span, 0, 1) : 1
    return { i, e: f * f * (3 - 2 * f) }
  }

  const tracks: KeyframeTrack[] = []
  const animated = new Set<BoneName>(keys.flatMap((k) => Object.keys(k.bones) as BoneName[]))
  const a = new Quaternion()
  const b = new Quaternion()
  const local = new Quaternion()
  for (const bone of animated) {
    const node = bones[bone]
    if (!node || !space.has(bone)) continue
    const values = new Float32Array(frames * 4)
    times.forEach((t, f) => {
      const { i, e } = segmentAt(t)
      toQuaternion(rotationAt(keys, i, bone), a)
      toQuaternion(rotationAt(keys, i + 1, bone), b)
      space.localRotation(bone, a.slerp(b, e), local)
      local.toArray(values, f * 4)
    })
    tracks.push(new QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values))
  }

  const hips = bones.Hips
  if (hips && space.has('Hips') && keys.some((k) => k.hips && k.hips.some((v) => v !== 0))) {
    const values = new Float32Array(frames * 3)
    const offset = new Vector3()
    const out = new Vector3()
    times.forEach((t, f) => {
      const { i, e } = segmentAt(t)
      const from = hipsAt(keys, i)
      const to = hipsAt(keys, i + 1)
      offset.set(MathUtils.lerp(from[0], to[0], e), MathUtils.lerp(from[1], to[1], e), MathUtils.lerp(from[2], to[2], e))
      space.localPosition('Hips', offset, out).toArray(values, f * 3)
    })
    tracks.push(new VectorKeyframeTrack(`${hips.name}.position`, times, values))
  }

  return new AnimationClip(name, duration, tracks)
}
