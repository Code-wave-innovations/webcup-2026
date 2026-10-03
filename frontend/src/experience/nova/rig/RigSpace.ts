import { MathUtils, Matrix3, Matrix4, Quaternion, Vector3, type Object3D } from 'three'
import type { BoneName } from './rigContract'

interface BindFrame {
  /** parent's rotation relative to the character root, in the bind pose */
  parent: Quaternion
  parentInverse: Quaternion
  /** bone's own bind transform */
  local: Quaternion
  position: Vector3
  /** character-root offsets → parent-local offsets (includes intermediate scales, e.g. an armature at 0.01) */
  offsetToParent: Matrix3
}

const scratch = new Quaternion()

/**
 * Bind-pose frames of a skeleton. Gestures are authored as rotations in the character's frame
 * (x right-to-left, y up, z forward, as on the stand-in whose rest pose is all identities):
 * `local = (Pᵂ⁻¹ · D · Pᵂ) · Lᵇ` turns such a rotation D into the bone's local rotation on any rig,
 * so the same gesture library drives a Mixamo skeleton as well as the stand-in.
 */
export class RigSpace {
  readonly root: Object3D
  private readonly frames = new Map<BoneName, BindFrame>()
  private readonly characterPositions = new Map<BoneName, Vector3>()

  constructor(root: Object3D, bones: Partial<Record<BoneName, Object3D>>) {
    this.root = root
    root.updateMatrixWorld(true)
    const rootInverse = new Matrix4().copy(root.matrixWorld).invert()
    const rootScale = new Vector3().setFromMatrixScale(root.matrixWorld)
    for (const [name, bone] of Object.entries(bones) as Array<[BoneName, Object3D]>) {
      this.characterPositions.set(name, new Vector3().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(rootInverse))
      const parentMatrix = new Matrix4().multiplyMatrices(rootInverse, bone.parent ? bone.parent.matrixWorld : root.matrixWorld)
      const parent = new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(parentMatrix))
      // character offsets are in normalised units (root scale applied): undo it, then go into the parent's space
      const toParent = new Matrix3().setFromMatrix4(parentMatrix).invert()
      toParent.multiplyScalar(1 / (rootScale.y || 1))
      this.frames.set(name, {
        parent,
        parentInverse: parent.clone().invert(),
        local: bone.quaternion.clone(),
        position: bone.position.clone(),
        offsetToParent: toParent,
      })
    }
  }

  has(bone: BoneName): boolean {
    return this.frames.has(bone)
  }

  /** Bone-local rotation for a character-space rotation `delta` applied on top of the bind pose. */
  localRotation(bone: BoneName, delta: Quaternion, out: Quaternion): Quaternion {
    const frame = this.frames.get(bone)
    if (!frame) return out.copy(delta)
    return out.copy(frame.parentInverse).multiply(delta).multiply(frame.parent).multiply(frame.local)
  }

  /** Adds a character-space rotation on top of the bone's current (animated) rotation. */
  applyAdditive(bone: BoneName, target: Object3D, delta: Quaternion): void {
    const frame = this.frames.get(bone)
    if (!frame) return
    scratch.copy(frame.parentInverse).multiply(delta).multiply(frame.parent)
    target.quaternion.premultiply(scratch)
  }

  /** Bone-local position for a character-space offset (normalised units) from the bind position. */
  localPosition(bone: BoneName, offset: Vector3, out: Vector3): Vector3 {
    const frame = this.frames.get(bone)
    if (!frame) return out.copy(offset)
    return out.copy(offset).applyMatrix3(frame.offsetToParent).add(frame.position)
  }

  bindPosition(bone: BoneName): Vector3 | undefined {
    return this.frames.get(bone)?.position
  }

  /** Where the joint sits in the bind pose, in the character's frame. */
  characterPosition(bone: BoneName): Vector3 | undefined {
    return this.characterPositions.get(bone)
  }

  /** Puts every bone back in its bind pose. */
  resetPose(bones: Partial<Record<BoneName, Object3D>>): void {
    for (const [name, bone] of Object.entries(bones) as Array<[BoneName, Object3D]>) {
      const frame = this.frames.get(name)
      if (!frame) continue
      bone.quaternion.copy(frame.local)
      bone.position.copy(frame.position)
    }
  }
}

const DOWN = new Vector3(0, -1, 0)
/** Arms closer than this to the vertical are left as modelled. */
const RELAX_FROM = MathUtils.degToRad(30)
/** Relaxed arms keep this angle away from the body, so the hands do not sink into the hips. */
const RELAX_TO = MathUtils.degToRad(8)

/**
 * Lowers T-pose or wide A-pose arms along the body before the bind frames are measured, so that the
 * gesture library (written from arms hanging down) means the same thing on any delivered skeleton.
 * No-op on the stand-in and on models whose arms already hang down.
 */
export function relaxArms(root: Object3D, bones: Partial<Record<BoneName, Object3D>>): void {
  const chains: Array<[BoneName, BoneName]> = [
    ['LeftArm', 'LeftForeArm'],
    ['LeftForeArm', 'LeftHand'],
    ['RightArm', 'RightForeArm'],
    ['RightForeArm', 'RightHand'],
  ]
  const rootRotation = new Quaternion()
  const from = new Vector3()
  const to = new Vector3()
  const correction = new Quaternion()
  const world = new Quaternion()
  const parentWorld = new Quaternion()
  for (const [boneName, childName] of chains) {
    const bone = bones[boneName]
    const child = bones[childName]
    if (!bone || !child) continue
    root.updateMatrixWorld(true)
    root.getWorldQuaternion(rootRotation)
    const direction = child.getWorldPosition(to).sub(bone.getWorldPosition(from)).applyQuaternion(rootRotation.clone().invert())
    if (direction.lengthSq() < 1e-10) continue
    direction.normalize()
    if (direction.angleTo(DOWN) < RELAX_FROM) continue
    // rotate the bone in character space so its segment hangs down, keeping its parent unchanged
    const side = Math.sign(direction.x) || 1
    correction.setFromUnitVectors(direction, new Vector3(side * Math.sin(RELAX_TO), -Math.cos(RELAX_TO), 0))
    const worldCorrection = rootRotation.clone().multiply(correction).multiply(rootRotation.clone().invert())
    bone.getWorldQuaternion(world)
    bone.parent?.getWorldQuaternion(parentWorld)
    bone.quaternion.copy(parentWorld.invert().multiply(worldCorrection).multiply(world))
  }
  root.updateMatrixWorld(true)
}
