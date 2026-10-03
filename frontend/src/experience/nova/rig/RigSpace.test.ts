import { Euler, Group, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { RigSpace } from './RigSpace'

const close = (a: Quaternion, b: Quaternion) => Math.abs(a.dot(b)) > 0.99999

describe('RigSpace', () => {
  it('returns the delta itself on a rig whose bind pose is all identities (the stand-in)', () => {
    const root = new Group()
    const arm = new Group()
    root.add(arm)
    const space = new RigSpace(root, { LeftArm: arm })
    const delta = new Quaternion().setFromEuler(new Euler(0.3, 0.2, -1))
    expect(close(space.localRotation('LeftArm', delta, new Quaternion()), delta)).toBe(true)
  })

  it('rotates a bone about character axes whatever the orientation of its parents', () => {
    // Mixamo-like: an armature turned -90° about X, a bone with its own bind rotation
    const root = new Group()
    const armature = new Group()
    armature.quaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0))
    const bone = new Group()
    bone.quaternion.setFromEuler(new Euler(0.4, 1.1, -0.2))
    root.add(armature)
    armature.add(bone)
    const space = new RigSpace(root, { Head: bone })

    const bindWorld = bone.getWorldQuaternion(new Quaternion())
    const delta = new Quaternion().setFromEuler(new Euler(0, Math.PI / 3, 0))
    space.localRotation('Head', delta, bone.quaternion)
    root.updateMatrixWorld(true)
    const expected = delta.clone().multiply(bindWorld)
    expect(close(bone.getWorldQuaternion(new Quaternion()), expected)).toBe(true)
  })

  it('moves a bone by a character-space offset, through scaled parents', () => {
    const root = new Group()
    root.scale.setScalar(2)
    const armature = new Group()
    armature.scale.setScalar(0.01)
    const hips = new Group()
    hips.position.set(0, 50, 0)
    root.add(armature)
    armature.add(hips)
    const space = new RigSpace(root, { Hips: hips })
    space.localPosition('Hips', new Vector3(0, 0.1, 0), hips.position)
    root.updateMatrixWorld(true)
    // 0.1 normalised unit = 0.05 root units = 5 armature units
    expect(hips.position.y).toBeCloseTo(55)
  })
})

describe('relaxArms', () => {
  it('lowers a T-pose arm along the body, slightly away from it', async () => {
    const { relaxArms } = await import('./RigSpace')
    const root = new Group()
    const arm = new Group()
    arm.position.set(0.2, 1.4, 0)
    const forearm = new Group()
    forearm.position.set(0.25, 0, 0) // T-pose: the forearm sits along +X
    const hand = new Group()
    hand.position.set(0.25, 0, 0)
    root.add(arm)
    arm.add(forearm)
    forearm.add(hand)
    relaxArms(root, { LeftArm: arm, LeftForeArm: forearm, LeftHand: hand })
    const elbow = forearm.getWorldPosition(new Vector3())
    const wrist = hand.getWorldPosition(new Vector3())
    const tilt = (8 * Math.PI) / 180
    expect(elbow.x).toBeCloseTo(0.2 + 0.25 * Math.sin(tilt))
    expect(elbow.y).toBeCloseTo(1.4 - 0.25 * Math.cos(tilt))
    expect(wrist.y).toBeCloseTo(1.4 - 0.5 * Math.cos(tilt))
  })

  it('leaves arms that already hang down untouched', async () => {
    const { relaxArms } = await import('./RigSpace')
    const root = new Group()
    const arm = new Group()
    const forearm = new Group()
    forearm.position.set(0.02, -0.25, 0)
    root.add(arm)
    arm.add(forearm)
    relaxArms(root, { LeftArm: arm, LeftForeArm: forearm })
    expect(arm.quaternion.equals(new Quaternion())).toBe(true)
  })
})
