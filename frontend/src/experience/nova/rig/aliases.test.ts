import { describe, expect, it } from 'vitest'
import { matchBones, matchClips, normalizeName } from './aliases'

describe('normalizeName', () => {
  it('strips exporter prefixes and punctuation', () => {
    expect(normalizeName('mixamorig:LeftForeArm')).toBe('leftforearm')
    expect(normalizeName('mixamorigLeftForeArm')).toBe('leftforearm')
    expect(normalizeName('DEF-upper_arm.L')).toBe('upperarml')
    expect(normalizeName('Armature|mixamo.com|Waving')).toBe('waving')
  })
})

describe('matchBones', () => {
  it('recognises a Mixamo skeleton (spine2 is the chest)', () => {
    const bones = matchBones(['mixamorigHips', 'mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2', 'mixamorigNeck', 'mixamorigHead', 'mixamorigLeftArm', 'mixamorigRightUpLeg'])
    expect(bones).toMatchObject({ Hips: 'mixamorigHips', Spine: 'mixamorigSpine', Chest: 'mixamorigSpine2', Head: 'mixamorigHead', LeftArm: 'mixamorigLeftArm', RightUpLeg: 'mixamorigRightUpLeg' })
  })

  it('recognises Blender left/right suffixes', () => {
    expect(matchBones(['upper_arm.L', 'forearm.R', 'thigh.L'])).toEqual({ LeftArm: 'upper_arm.L', RightForeArm: 'forearm.R', LeftUpLeg: 'thigh.L' })
  })

  it('never assigns one node to two bones', () => {
    const bones = matchBones(['Spine'])
    expect(bones.Spine).toBe('Spine')
    expect(bones.Chest).toBeUndefined()
  })
})

describe('matchClips', () => {
  it('maps Mixamo animation names to Nova clips', () => {
    expect(matchClips(['Armature|Idle', 'Walking', 'Waving', 'Shaking Head No', 'Victory'])).toEqual({
      idle: 'Armature|Idle',
      walk: 'Walking',
      wave: 'Waving',
      shakeHead: 'Shaking Head No',
      celebrate: 'Victory',
    })
  })
})
