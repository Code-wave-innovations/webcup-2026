/*
 * The contract any Nova model fulfils (see the plan, §4): humanoid bones, named clips, feet at the origin,
 * facing +Z. The procedural stand-in follows it too, so a delivered GLB replaces it without rewiring.
 */

export const BONES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Antenna',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot',
  'RightUpLeg', 'RightLeg', 'RightFoot',
] as const
export type BoneName = (typeof BONES)[number]

/** Bones the behaviour cannot do without (looking around, gestures, walking). */
export const REQUIRED_BONES: readonly BoneName[] = ['Hips', 'Spine', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg']

export const CLIPS = ['idle', 'walk', 'wave', 'talk', 'celebrate', 'shakeHead', 'point', 'think', 'coverEyes', 'peek', 'listen', 'brace', 'poked'] as const
export type ClipName = (typeof CLIPS)[number]

/** Clips a delivered model must bring; the others are generated on its skeleton when missing. */
export const REQUIRED_CLIPS: readonly ClipName[] = ['idle', 'walk', 'wave', 'talk', 'celebrate']

/**
 * How feelings are drawn: a screen shader on a visor, the light of the armour lines (faceless helmet),
 * morph targets, eye meshes, or not at all.
 */
export type FaceMode = 'visor' | 'glow' | 'morphs' | 'eyes' | 'none'

/** What was found in a model, shown on the test bench. */
export interface RigReport {
  source: string
  bones: Partial<Record<BoneName, string>>
  missingBones: BoneName[]
  /** clip name in the model, per Nova clip */
  clips: Partial<Record<ClipName, string>>
  /** clips generated procedurally because the model lacks them */
  generatedClips: ClipName[]
  face: FaceMode
  /** native height before normalisation (model units) */
  nativeHeight: number
}
