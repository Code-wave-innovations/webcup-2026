import { AnimationMixer, Quaternion, Vector3, type Object3D } from 'three'
import type { NovaRig } from '../rig/createRig'

/** Typical in-place walk of a 1 unit tall character, used if the cycle cannot be measured. */
const FALLBACK_SPEED = 0.8
const SAMPLES = 48

/**
 * Ground speed of the in-place walk cycle, in Nova heights per second: how fast the planted foot slides
 * backwards relative to the body. Moving Nova at this speed (times the clip's time scale) keeps its feet
 * fixed on the ground. Samples the clip once on the rig, then puts the pose back.
 */
export function measureWalkSpeed(rig: NovaRig): number {
  const foot = rig.bones.LeftFoot
  const clip = rig.clips.walk
  if (!foot || !clip || clip.duration <= 0) return FALLBACK_SPEED

  const saved: Array<[Object3D, Quaternion, Vector3]> = []
  rig.root.traverse((node) => saved.push([node, node.quaternion.clone(), node.position.clone()]))
  const mixer = new AnimationMixer(rig.root)
  mixer.clipAction(clip).play()
  const point = new Vector3()
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i <= SAMPLES; i++) {
    mixer.setTime((clip.duration * i) / SAMPLES)
    rig.root.updateMatrixWorld(true)
    rig.root.worldToLocal(foot.getWorldPosition(point))
    min = Math.min(min, point.z)
    max = Math.max(max, point.z)
  }
  mixer.stopAllAction()
  mixer.uncacheRoot(rig.root)
  for (const [node, quaternion, position] of saved) {
    node.quaternion.copy(quaternion)
    node.position.copy(position)
  }
  rig.root.updateMatrixWorld(true)

  // the planted foot travels the whole stride during half the cycle
  const speed = (max - min) / (clip.duration / 2)
  return speed > 0.05 ? speed : FALLBACK_SPEED
}
