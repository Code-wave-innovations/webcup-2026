import type { BoneName, ClipName } from '../rig/rigContract'

/** Rotation in the character's frame, in degrees (x: pitch, y: yaw, z: roll), applied z → x → y (Euler 'YXZ'). */
export type Rotation = readonly [x: number, y: number, z: number]

/** Points of the face a hand can reach (anchored to the head, measured on each model). */
export type FaceAnchor = 'eyeL' | 'eyeR' | 'chin' | 'cheekL' | 'cheekR'

/** A hand placed by inverse kinematics instead of authored angles: it lands on the face whatever the proportions. */
export interface Reach {
  side: 'Left' | 'Right'
  to: FaceAnchor
  /** distance in front of the face (normalised units): the hand rests on it, not inside it */
  standoff: number
  /** extra offset in the character's frame */
  offset?: readonly [number, number, number]
  /** where the elbow points, in the character's frame */
  pole: readonly [number, number, number]
}

export interface PoseKey {
  t: number
  bones: Partial<Record<BoneName, Rotation>>
  /** hips offset from the bind position, in normalised units (Nova is 1 unit tall) */
  hips?: readonly [x: number, y: number, z: number]
  /** hands solved by inverse kinematics on the rig (they override the arm angles) */
  reach?: readonly Reach[]
}

export interface ClipDefinition {
  duration: number
  loop: boolean
  keys: PoseKey[]
}

/*
 * Conventions, from the stand-in's rest pose (arms hanging, facing +Z, its left side towards +X):
 * arm raised sideways: Left +z / Right -z · arm raised forwards: -x · elbow / knee bent: -x / +x
 * head turned to its left: +y · head looking up: -x · head tilted towards its right shoulder: +z
 */

const REST_ARMS = {
  LeftArm: [0, 0, 5],
  RightArm: [0, 0, -5],
  LeftForeArm: [-8, 0, 0],
  RightForeArm: [-8, 0, 0],
} as const satisfies Partial<Record<BoneName, Rotation>>

const rest = (t: number): PoseKey => ({ t, bones: { ...REST_ARMS, Head: [0, 0, 0], Chest: [0, 0, 0] }, hips: [0, 0, 0] })

/** Swaps left and right in a pose (and mirrors yaw and roll), to write a walk cycle once. */
function mirror(key: PoseKey, t: number): PoseKey {
  const bones: Partial<Record<BoneName, Rotation>> = {}
  for (const [name, [x, y, z]] of Object.entries(key.bones) as Array<[BoneName, Rotation]>) {
    const swapped = (name.startsWith('Left') ? name.replace('Left', 'Right') : name.startsWith('Right') ? name.replace('Right', 'Left') : name) as BoneName
    bones[swapped] = [x, -y, -z]
  }
  return { t, bones, hips: key.hips }
}

const walkContact: PoseKey = {
  t: 0,
  bones: {
    LeftUpLeg: [-26, 0, 0], LeftLeg: [6, 0, 0], LeftFoot: [-12, 0, 0],
    RightUpLeg: [20, 0, 0], RightLeg: [32, 0, 0], RightFoot: [12, 0, 0],
    LeftArm: [20, 0, 5], RightArm: [-20, 0, -5], LeftForeArm: [-14, 0, 0], RightForeArm: [-28, 0, 0],
    Hips: [0, 4, 0], Spine: [3, 0, 0], Chest: [0, -6, 0], Head: [0, 2, 0],
  },
  hips: [0, 0, 0],
}
const walkPassing: PoseKey = {
  t: 0.225,
  bones: {
    LeftUpLeg: [-4, 0, 0], LeftLeg: [6, 0, 0], LeftFoot: [0, 0, 0],
    RightUpLeg: [-14, 0, 0], RightLeg: [52, 0, 0], RightFoot: [8, 0, 0],
    LeftArm: [2, 0, 5], RightArm: [-2, 0, -5], LeftForeArm: [-18, 0, 0], RightForeArm: [-18, 0, 0],
    Hips: [0, 0, 0], Spine: [3, 0, 0], Chest: [0, 0, 0], Head: [0, 0, 0],
  },
  hips: [0, 0.018, 0],
}

const ELBOWS_OUT_LEFT = [1, -0.7, -0.1] as const
const ELBOWS_OUT_RIGHT = [-1, -0.7, -0.1] as const

// head bowed, both hands over the eyes
const coverKey = (t: number, fidget: number): PoseKey => ({
  t,
  bones: { Head: [20 + fidget, 0, 0], Neck: [4, 0, 0], Chest: [10, 0, 0], LeftHand: [-10, 0, 0], RightHand: [-10, 0, 0] },
  reach: [
    { side: 'Left', to: 'eyeL', standoff: 0.035, offset: [0, 0.02, 0], pole: ELBOWS_OUT_LEFT },
    { side: 'Right', to: 'eyeR', standoff: 0.035, offset: [0, 0.02, 0], pole: ELBOWS_OUT_RIGHT },
  ],
})

// one hand still on the right eye, the left hand slid down to the cheek: the left eye peeks out
const peekKey = (t: number, fidget: number): PoseKey => ({
  t,
  bones: { Head: [14, 8 + fidget, -6], Neck: [2, 0, 0], Chest: [10, 0, 0], LeftHand: [-10, 0, 0], RightHand: [-10, 0, 0] },
  reach: [
    { side: 'Right', to: 'eyeR', standoff: 0.035, offset: [0, 0.02, 0], pole: ELBOWS_OUT_RIGHT },
    { side: 'Left', to: 'cheekL', standoff: 0.03, offset: [0.01, -0.01, 0], pole: ELBOWS_OUT_LEFT },
  ],
})

// right hand under the chin, left arm folded across the waist, eyes up
const thinkKey = (t: number, tilt: number): PoseKey => ({
  t,
  bones: { LeftArm: [-25, 0, 10], LeftForeArm: [-88, 0, 0], RightHand: [-25, 0, 0], Head: [-12, 6, tilt], Chest: [-2, 0, 0] },
  reach: [{ side: 'Right', to: 'chin', standoff: 0.03, offset: [0, -0.02, 0], pole: [-0.4, -1, 0.3] }],
})

const presentKey = (t: number, sway: number): PoseKey => ({
  t,
  bones: {
    RightArm: [-112 - 3 * sway, 0, -16],
    RightForeArm: [-6 + 2 * sway, 0, 0],
    RightHand: [0, 0, 0],
    LeftArm: [4, 0, 9],
    LeftForeArm: [-14, 0, 0],
    Chest: [-4, -8, 0],
    Head: [-6 - 2 * sway, -10, 0],
  },
})

// arms crossed, weight on the left leg, the right foot tapping: waiting for the lock to lift
const sulkKey = (t: number, tap: number): PoseKey => ({
  t,
  hips: [0.012, 0, 0],
  bones: {
    LeftArm: [-14, -72, 14], RightArm: [-18, 72, -14], LeftForeArm: [-80, 0, 0], RightForeArm: [-72, 0, 0],
    LeftHand: [0, 0, 0], RightHand: [0, 0, 0],
    Chest: [-3, 0, -2], Head: [-4, 12, 6], Hips: [0, 0, 3],
    RightUpLeg: [-6, 0, -5], RightLeg: [10, 0, 0], RightFoot: [-26 * tap, 0, 0],
  },
})

const bracePose = (shake: number): PoseKey['bones'] => ({
  LeftUpLeg: [-44, 0, 4], RightUpLeg: [-44, 0, -4], LeftLeg: [78, 0, 0], RightLeg: [78, 0, 0], LeftFoot: [-34, 0, 0], RightFoot: [-34, 0, 0],
  Spine: [20, 0, 0], Chest: [6 + shake, 0, 0],
  LeftArm: [-72, 0, 10], RightArm: [-72, 0, -10], LeftForeArm: [-22, 0, 0], RightForeArm: [-22, 0, 0],
  Head: [-18, 0, 0],
})

// anticipation of the take-off: deep knee bend, torso forward, fists back and down, eyes on the sky ahead
const crouchKey = (t: number, coil: number): PoseKey => ({
  t,
  hips: [0, -0.15 - 0.012 * coil, 0.01],
  bones: {
    LeftUpLeg: [-74, 0, 7], RightUpLeg: [-74, 0, -7], LeftLeg: [118, 0, 0], RightLeg: [118, 0, 0], LeftFoot: [-42, 0, 0], RightFoot: [-42, 0, 0],
    Spine: [26 + 2 * coil, 0, 0], Chest: [10, 0, 0], Neck: [-10, 0, 0], Head: [-26, 0, 0],
    LeftArm: [34, 0, 24], RightArm: [34, 0, -24], LeftForeArm: [-14, 0, 0], RightForeArm: [-14, 0, 0], LeftHand: [-40, 0, 0], RightHand: [-40, 0, 0],
  },
})

// in the air (the body lies along the flight): legs together and straight, toes pointed, arms along the body with
// the palms backwards (the repulsors), back arched and head raised to look ahead; the legs trail a little in the wind
const flyKey = (t: number, wind: number): PoseKey => ({
  t,
  hips: [0, 0, 0],
  bones: {
    LeftUpLeg: [5 + wind, 0, 2], RightUpLeg: [5 - wind, 0, -2], LeftLeg: [7 - wind, 0, 0], RightLeg: [7 + wind, 0, 0], LeftFoot: [42, 0, 0], RightFoot: [42, 0, 0],
    Spine: [-7, 0, 0], Chest: [-5, 0, 0], Neck: [-22, 0, 0], Head: [-34, 0, 0],
    LeftArm: [14, 0, 13 + wind * 0.5], RightArm: [14, 0, -13 - wind * 0.5], LeftForeArm: [-4, 0, 0], RightForeArm: [-4, 0, 0], LeftHand: [62, 0, 0], RightHand: [62, 0, 0],
  },
})

// the superhero landing: right knee and right fist on the ground, left foot planted ahead, left arm swept back,
// head down at the impact, then looking up before standing
const landKey = (t: number, sink: number, look: number): PoseKey => ({
  t,
  hips: [0, -0.23 - sink, -0.03],
  bones: {
    LeftUpLeg: [-84, 0, 8], LeftLeg: [100, 0, 0], LeftFoot: [-16, 0, 0],
    RightUpLeg: [14, 0, -6], RightLeg: [104, 0, 0], RightFoot: [38, 0, 0],
    Spine: [36 + 30 * sink, 0, 0], Chest: [16, -10, 0], Neck: [6 - 10 * look, 0, 0], Head: [26 - 46 * look, 8, 0],
    RightArm: [-58, 0, -12], RightForeArm: [-8, 0, 0], RightHand: [10, 0, 0],
    LeftArm: [44, 0, 52], LeftForeArm: [-12, 0, 0], LeftHand: [0, 0, 0],
  },
})

/** Nova's gestures. A delivered model may bring its own; missing ones are generated from these. */
export const POSE_LIBRARY: Record<ClipName, ClipDefinition> = {
  idle: {
    duration: 4,
    loop: true,
    keys: [
      rest(0),
      { t: 2, bones: { LeftArm: [2, 0, 7], RightArm: [2, 0, -7], LeftForeArm: [-12, 0, 0], RightForeArm: [-12, 0, 0], Head: [1.5, 0, 2], Chest: [1, 0, 0] } },
      rest(4),
    ],
  },
  walk: {
    duration: 0.9,
    loop: true,
    keys: [walkContact, walkPassing, mirror(walkContact, 0.45), mirror(walkPassing, 0.675), { ...walkContact, t: 0.9 }],
  },
  wave: {
    duration: 1.9,
    loop: false,
    keys: [
      rest(0),
      { t: 0.35, bones: { RightArm: [-12, 0, -150], RightForeArm: [0, 0, 34], LeftArm: [0, 0, 8], Head: [0, -6, 8], Chest: [0, 0, 4] } },
      { t: 0.55, bones: { RightForeArm: [0, 0, 18] } },
      { t: 0.75, bones: { RightForeArm: [0, 0, 62] } },
      { t: 0.95, bones: { RightForeArm: [0, 0, 18] } },
      { t: 1.15, bones: { RightForeArm: [0, 0, 62] } },
      { t: 1.4, bones: { RightArm: [-12, 0, -146], RightForeArm: [0, 0, 34], Head: [0, -6, 8], Chest: [0, 0, 4] } },
      rest(1.9),
    ],
  },
  talk: {
    duration: 2.4,
    loop: true,
    keys: [
      { t: 0, bones: { LeftArm: [-12, 0, 8], RightArm: [-12, 0, -8], LeftForeArm: [-55, 0, 0], RightForeArm: [-45, 0, 0], Head: [2, 0, 0] } },
      { t: 0.6, bones: { LeftForeArm: [-72, 0, -10], RightForeArm: [-40, 0, 0], Head: [-3, 5, 0] } },
      { t: 1.2, bones: { LeftForeArm: [-50, 0, 0], RightForeArm: [-74, 0, 10], Head: [3, -4, 0] } },
      { t: 1.8, bones: { LeftForeArm: [-64, 0, 0], RightForeArm: [-50, 0, 0], Head: [-2, 0, 3] } },
      { t: 2.4, bones: { LeftArm: [-12, 0, 8], RightArm: [-12, 0, -8], LeftForeArm: [-55, 0, 0], RightForeArm: [-45, 0, 0], Head: [2, 0, 0] } },
    ],
  },
  celebrate: {
    duration: 1.5,
    loop: false,
    keys: [
      rest(0),
      {
        t: 0.18,
        hips: [0, -0.045, 0],
        bones: { LeftUpLeg: [-36, 0, 0], RightUpLeg: [-36, 0, 0], LeftLeg: [66, 0, 0], RightLeg: [66, 0, 0], LeftFoot: [-30, 0, 0], RightFoot: [-30, 0, 0], Spine: [12, 0, 0], LeftArm: [22, 0, 12], RightArm: [22, 0, -12] },
      },
      {
        t: 0.5,
        hips: [0, 0.11, 0],
        bones: { LeftUpLeg: [-8, 0, 0], RightUpLeg: [-8, 0, 0], LeftLeg: [18, 0, 0], RightLeg: [18, 0, 0], LeftFoot: [12, 0, 0], RightFoot: [12, 0, 0], Spine: [-6, 0, 0], LeftArm: [0, 0, 160], RightArm: [0, 0, -160], LeftForeArm: [0, 0, 12], RightForeArm: [0, 0, -12], Head: [-14, 0, 0] },
      },
      { t: 0.75, hips: [0, 0.08, 0], bones: { LeftArm: [0, 0, 148], RightArm: [0, 0, -148], LeftForeArm: [0, 0, -8], RightForeArm: [0, 0, 8], Head: [-10, 0, 4] } },
      {
        t: 0.95,
        hips: [0, -0.035, 0],
        bones: { LeftUpLeg: [-30, 0, 0], RightUpLeg: [-30, 0, 0], LeftLeg: [56, 0, 0], RightLeg: [56, 0, 0], LeftFoot: [-26, 0, 0], RightFoot: [-26, 0, 0], Spine: [8, 0, 0], LeftArm: [0, 0, 118], RightArm: [0, 0, -118] },
      },
      { t: 1.2, hips: [0, 0, 0], bones: { LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], LeftFoot: [0, 0, 0], RightFoot: [0, 0, 0], Spine: [0, 0, 0], LeftArm: [0, 0, 55], RightArm: [0, 0, -55] } },
      rest(1.5),
    ],
  },
  shakeHead: {
    duration: 1.0,
    loop: false,
    keys: [
      rest(0),
      { t: 0.15, bones: { Head: [6, 24, 0], Neck: [0, 8, 0] } },
      { t: 0.35, bones: { Head: [6, -22, 0], Neck: [0, -8, 0] } },
      { t: 0.55, bones: { Head: [6, 18, 0], Neck: [0, 6, 0] } },
      { t: 0.75, bones: { Head: [6, -12, 0], Neck: [0, -4, 0] } },
      { t: 1.0, bones: { Head: [4, 0, 0], Neck: [0, 0, 0] } },
    ],
  },
  point: {
    duration: 1.6,
    loop: false,
    keys: [
      rest(0),
      { t: 0.35, bones: { RightArm: [-82, 0, -22], RightForeArm: [-6, 0, 0], RightHand: [0, 0, 0], Head: [0, -18, 0], Chest: [0, -8, 0] } },
      { t: 1.25, bones: { RightArm: [-80, 0, -20], RightForeArm: [-4, 0, 0], Head: [0, -14, 0], Chest: [0, -8, 0] } },
      rest(1.6),
    ],
  },
  // held at rest on a district: the right arm raised towards the dome, the body opened to the visitor
  present: { duration: 2.8, loop: true, keys: [presentKey(0, 0), presentKey(1.4, 1), presentKey(2.8, 0)] },
  sulk: { duration: 1, loop: true, keys: [sulkKey(0, 0), sulkKey(0.18, 1), sulkKey(0.36, 0), sulkKey(0.54, 1), sulkKey(0.72, 0), sulkKey(1, 0)] },
  think: { duration: 3, loop: true, keys: [thinkKey(0, 10), thinkKey(1.5, 14), thinkKey(3, 10)] },
  coverEyes: { duration: 1.2, loop: true, keys: [coverKey(0, 0), coverKey(0.6, 3), coverKey(1.2, 0)] },
  peek: { duration: 1.6, loop: true, keys: [peekKey(0, 0), peekKey(0.8, 4), peekKey(1.6, 0)] },
  listen: {
    duration: 2.4,
    loop: true,
    keys: [
      { t: 0, bones: { Chest: [8, 0, 0], Head: [4, 0, -14], LeftArm: [12, 0, -4], RightArm: [12, 0, 4], LeftForeArm: [-32, 0, 0], RightForeArm: [-32, 0, 0] } },
      { t: 1.2, bones: { Chest: [9, 0, 0], Head: [9, 0, -12], LeftArm: [12, 0, -4], RightArm: [12, 0, 4], LeftForeArm: [-32, 0, 0], RightForeArm: [-32, 0, 0] } },
      { t: 2.4, bones: { Chest: [8, 0, 0], Head: [4, 0, -14], LeftArm: [12, 0, -4], RightArm: [12, 0, 4], LeftForeArm: [-32, 0, 0], RightForeArm: [-32, 0, 0] } },
    ],
  },
  brace: {
    duration: 0.5,
    loop: true,
    keys: [
      { t: 0, hips: [0, -0.06, 0], bones: bracePose(0) },
      { t: 0.25, hips: [0, -0.062, 0], bones: bracePose(1.5) },
      { t: 0.5, hips: [0, -0.06, 0], bones: bracePose(0) },
    ],
  },
  hop: {
    duration: 0.6,
    loop: false,
    keys: [
      rest(0),
      { t: 0.12, hips: [0, -0.03, 0], bones: { LeftUpLeg: [-22, 0, 0], RightUpLeg: [-22, 0, 0], LeftLeg: [40, 0, 0], RightLeg: [40, 0, 0], LeftFoot: [-18, 0, 0], RightFoot: [-18, 0, 0], LeftArm: [0, 0, 20], RightArm: [0, 0, -20] } },
      { t: 0.3, hips: [0, 0.045, 0], bones: { LeftUpLeg: [-4, 0, 0], RightUpLeg: [-4, 0, 0], LeftLeg: [8, 0, 0], RightLeg: [8, 0, 0], LeftFoot: [10, 0, 0], RightFoot: [10, 0, 0], LeftArm: [0, 0, 32], RightArm: [0, 0, -32], Head: [-8, 0, 0] } },
      { t: 0.45, hips: [0, -0.015, 0], bones: { LeftUpLeg: [-14, 0, 0], RightUpLeg: [-14, 0, 0], LeftLeg: [26, 0, 0], RightLeg: [26, 0, 0], LeftFoot: [-12, 0, 0], RightFoot: [-12, 0, 0], LeftArm: [0, 0, 12], RightArm: [0, 0, -12] } },
      { ...rest(0.6), bones: { ...rest(0.6).bones, LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], LeftFoot: [0, 0, 0], RightFoot: [0, 0, 0] } },
    ],
  },
  crouch: { duration: 0.6, loop: true, keys: [crouchKey(0, 0), crouchKey(0.3, 1), crouchKey(0.6, 0)] },
  fly: { duration: 1.4, loop: true, keys: [flyKey(0, 0), flyKey(0.7, 4), flyKey(1.4, 0)] },
  land: {
    duration: 1.3,
    loop: false,
    keys: [
      { ...landKey(0, 0.04, 0), hips: [0, -0.16, -0.03] },
      landKey(0.09, 0.06, 0),
      landKey(0.28, 0, 0),
      landKey(0.62, 0, 1),
      {
        t: 1.0,
        hips: [0, -0.08, 0],
        bones: {
          LeftUpLeg: [-40, 0, 4], LeftLeg: [56, 0, 0], LeftFoot: [-16, 0, 0], RightUpLeg: [-20, 0, -4], RightLeg: [48, 0, 0], RightFoot: [-20, 0, 0],
          Spine: [12, 0, 0], Chest: [4, 0, 0], Neck: [0, 0, 0], Head: [-6, 0, 0],
          RightArm: [-10, 0, -14], RightForeArm: [-20, 0, 0], RightHand: [0, 0, 0], LeftArm: [6, 0, 18], LeftForeArm: [-14, 0, 0],
        },
      },
      {
        ...rest(1.3),
        bones: { ...rest(1.3).bones, LeftUpLeg: [0, 0, 0], RightUpLeg: [0, 0, 0], LeftLeg: [0, 0, 0], RightLeg: [0, 0, 0], LeftFoot: [0, 0, 0], RightFoot: [0, 0, 0], Spine: [0, 0, 0], Neck: [0, 0, 0], LeftHand: [0, 0, 0], RightHand: [0, 0, 0] },
      },
    ],
  },
  poked: {
    duration: 0.85,
    loop: false,
    keys: [
      rest(0),
      { t: 0.15, hips: [0, -0.02, 0], bones: { Head: [10, 0, 12], LeftArm: [0, 0, 28], RightArm: [0, 0, -28], Chest: [6, 0, 0] } },
      { t: 0.35, hips: [0, 0.01, 0], bones: { Head: [-6, 0, -12], LeftArm: [0, 0, 18], RightArm: [0, 0, -18], Chest: [-2, 0, 0] } },
      { t: 0.55, bones: { Head: [4, 0, 9], LeftArm: [0, 0, 12], RightArm: [0, 0, -12] } },
      rest(0.85),
    ],
  },
}
