import { Euler, MathUtils, Quaternion, Vector3, type Object3D } from 'three'
import type { RigSpace } from '../rig/RigSpace'
import type { BoneName } from '../rig/rigContract'
import type { ClipDefinition, FaceAnchor, PoseKey, Reach, Rotation } from './poseLibrary'

/** Face points in the Head bone's local frame, measured on the model in its bind pose. */
export type FaceAnchors = Record<FaceAnchor, Vector3>

/** Wrist to palm centre, as a share of the forearm: the palm, not the wrist, lands on the target. */
const PALM = 0.35
const ANCESTORS: Record<'Left' | 'Right', BoneName[]> = {
  Left: ['Hips', 'Spine', 'Chest', 'LeftShoulder'],
  Right: ['Hips', 'Spine', 'Chest', 'RightShoulder'],
}
const POSE_CHAIN: BoneName[] = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder']

const toQuaternion = ([x, y, z]: Rotation, out = new Quaternion()) =>
  out.setFromEuler(new Euler(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z), 'YXZ'))

const toRotation = (q: Quaternion): Rotation => {
  const e = new Euler().setFromQuaternion(q, 'YXZ')
  return [MathUtils.radToDeg(e.x), MathUtils.radToDeg(e.y), MathUtils.radToDeg(e.z)]
}

/**
 * Two-bone inverse kinematics for one hand, in the character's frame: the elbow sits on the circle allowed
 * by the arm's lengths, on the side of the pole; returns the character-space rotations of arm and forearm
 * (relative to their parents' rotations, as the gesture library expects).
 */
function solveArm(key: PoseKey, reach: Reach, space: RigSpace, bones: Partial<Record<BoneName, Object3D>>, anchors: FaceAnchors) {
  const arm = `${reach.side}Arm` as const
  const forearm = `${reach.side}ForeArm` as const
  const hand = `${reach.side}Hand` as const
  const s0 = space.characterPosition(arm)
  const e0 = space.characterPosition(forearm)
  const w0 = space.characterPosition(hand)
  const head = bones.Head
  const armNode = bones[arm]
  if (!s0 || !e0 || !w0 || !head || !armNode) return null

  const root = space.root
  const upper = e0.distanceTo(s0)
  const lower = w0.distanceTo(e0) * (1 + PALM)
  const restArm = e0.clone().sub(s0).normalize()
  const restForearm = w0.clone().sub(e0).normalize()

  // target: the face anchor carried by the posed head, pushed straight out in front of the face
  // (horizontally: following a bowed head would slide the hand down to the mouth)
  const target = root.worldToLocal(head.localToWorld(anchors[reach.to].clone()))
  target.z += reach.standoff
  if (reach.offset) target.add(new Vector3(...reach.offset))
  const shoulder = root.worldToLocal(armNode.getWorldPosition(new Vector3()))

  const toTarget = target.clone().sub(shoulder)
  const distance = MathUtils.clamp(toTarget.length(), Math.abs(upper - lower) + 1e-4, upper + lower - 1e-4)
  const along = toTarget.normalize()
  const pole = new Vector3(...reach.pole)
  pole.addScaledVector(along, -pole.dot(along)).normalize()
  const cosA = (upper * upper + distance * distance - lower * lower) / (2 * upper * distance)
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  const elbow = shoulder.clone().addScaledVector(along, upper * cosA).addScaledVector(pole, upper * sinA)
  const palm = shoulder.clone().addScaledVector(along, distance)

  const parents = new Quaternion()
  for (const bone of ANCESTORS[reach.side]) {
    const r = key.bones[bone]
    if (r) parents.multiply(toQuaternion(r))
  }
  const upperDir = elbow.clone().sub(shoulder).normalize().applyQuaternion(parents.clone().invert())
  const armDelta = new Quaternion().setFromUnitVectors(restArm, upperDir)
  const lowerDir = palm.sub(elbow).normalize().applyQuaternion(parents.clone().multiply(armDelta).invert())
  const forearmDelta = new Quaternion().setFromUnitVectors(restForearm, lowerDir)
  return { [arm]: toRotation(armDelta), [forearm]: toRotation(forearmDelta) } as Partial<Record<BoneName, Rotation>>
}

/** Fills in the arm angles of every key that places a hand on the face, by inverse kinematics on this rig. */
export function solveReaches(
  definition: ClipDefinition,
  space: RigSpace,
  bones: Partial<Record<BoneName, Object3D>>,
  anchors: FaceAnchors | null,
): ClipDefinition {
  if (!anchors || !definition.keys.some((k) => k.reach)) return definition
  const scratch = new Quaternion()
  const keys = definition.keys.map((key) => {
    if (!key.reach) return key
    // pose the torso and head as the key asks, so the face anchors are where they will be
    space.resetPose(bones)
    for (const bone of POSE_CHAIN) {
      const node = bones[bone]
      const r = key.bones[bone]
      if (node && r) space.localRotation(bone, toQuaternion(r, scratch), node.quaternion)
    }
    space.root.updateMatrixWorld(true)
    const solved: Partial<Record<BoneName, Rotation>> = {}
    for (const reach of key.reach) Object.assign(solved, solveArm(key, reach, space, bones, anchors))
    return { ...key, bones: { ...key.bones, ...solved } }
  })
  space.resetPose(bones)
  space.root.updateMatrixWorld(true)
  return { ...definition, keys }
}
