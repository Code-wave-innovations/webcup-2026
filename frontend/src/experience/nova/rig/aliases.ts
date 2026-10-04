import type { BoneName, ClipName } from './rigContract'

/** Lower-case letters and digits only, without the usual exporter prefixes (Mixamo, Blender armature, Rigify). */
export function normalizeName(name: string): string {
  const last = name.split('|').pop() ?? name
  return last
    .replace(/^mixamorig[:_]?/i, '')
    .replace(/^(def|org|mch)[-_.]/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const side = (left: string[], right: string[]) => ({ left, right })

/** Accepted spellings per bone, already normalised (Mixamo, Blender/Rigify `.L`, Quaternius, VRM). */
const BONE_ALIASES: Record<BoneName, readonly string[]> = (() => {
  const shoulder = side(['leftshoulder', 'shoulderl', 'lshoulder', 'claviclel', 'leftclavicle'], ['rightshoulder', 'shoulderr', 'rshoulder', 'clavicler', 'rightclavicle'])
  const arm = side(['leftarm', 'upperarml', 'leftupperarm', 'lupperarm', 'arml'], ['rightarm', 'upperarmr', 'rightupperarm', 'rupperarm', 'armr'])
  const forearm = side(['leftforearm', 'forearml', 'lowerarml', 'leftlowerarm', 'lforearm'], ['rightforearm', 'forearmr', 'lowerarmr', 'rightlowerarm', 'rforearm'])
  const hand = side(['lefthand', 'handl', 'lhand', 'palml', 'palm2l'], ['righthand', 'handr', 'rhand', 'palmr', 'palm2r'])
  const upLeg = side(['leftupleg', 'thighl', 'upperlegl', 'leftupperleg', 'lthigh'], ['rightupleg', 'thighr', 'upperlegr', 'rightupperleg', 'rthigh'])
  const leg = side(['leftleg', 'shinl', 'calfl', 'lowerlegl', 'leftlowerleg', 'lcalf'], ['rightleg', 'shinr', 'calfr', 'lowerlegr', 'rightlowerleg', 'rcalf'])
  const foot = side(['leftfoot', 'footl', 'lfoot'], ['rightfoot', 'footr', 'rfoot'])
  return {
    Hips: ['hips', 'pelvis', 'hip'],
    Spine: ['spine', 'abdomen', 'spine01'],
    Chest: ['spine2', 'chest', 'upperchest', 'torso', 'spine1', 'spine02'],
    Neck: ['neck', 'neck01'],
    Head: ['head'],
    Antenna: ['antenna', 'antenne', 'antenna1'],
    LeftShoulder: shoulder.left,
    RightShoulder: shoulder.right,
    LeftArm: arm.left,
    RightArm: arm.right,
    LeftForeArm: forearm.left,
    RightForeArm: forearm.right,
    LeftHand: hand.left,
    RightHand: hand.right,
    LeftUpLeg: upLeg.left,
    RightUpLeg: upLeg.right,
    LeftLeg: leg.left,
    RightLeg: leg.right,
    LeftFoot: foot.left,
    RightFoot: foot.right,
  }
})()

/** Finds each Nova bone among the model's node names (earlier aliases win, each node used once). */
export function matchBones(nodeNames: readonly string[]): Partial<Record<BoneName, string>> {
  const byNormalized = new Map<string, string>()
  for (const name of nodeNames) {
    const key = normalizeName(name)
    if (key && !byNormalized.has(key)) byNormalized.set(key, name)
  }
  const used = new Set<string>()
  const result: Partial<Record<BoneName, string>> = {}
  for (const [bone, aliases] of Object.entries(BONE_ALIASES) as Array<[BoneName, readonly string[]]>) {
    for (const alias of aliases) {
      const node = byNormalized.get(alias)
      if (node && !used.has(node)) {
        result[bone] = node
        used.add(node)
        break
      }
    }
  }
  return result
}

const CLIP_ALIASES: Record<ClipName, readonly string[]> = {
  idle: ['idle', 'breathingidle', 'standing', 'stand'],
  walk: ['walk', 'walking', 'walkinplace', 'walkcycle'],
  wave: ['wave', 'waving', 'hello', 'greet'],
  talk: ['talk', 'talking', 'speak'],
  celebrate: ['celebrate', 'victory', 'cheering', 'cheer', 'dance', 'jump'],
  shakeHead: ['shakehead', 'shakingheadno', 'headshake', 'no'],
  point: ['point', 'pointing', 'pointingforward'],
  think: ['think', 'thinking'],
  coverEyes: ['covereyes', 'hideeyes', 'cover'],
  peek: ['peek', 'peeking'],
  listen: ['listen', 'listening'],
  brace: ['brace', 'bracing', 'hold'],
  poked: ['poked', 'tickle', 'giggle'],
  hop: ['hop', 'smalljump', 'bounce'],
  present: ['present', 'presenting', 'showing', 'pointhold'],
  sulk: ['sulk', 'crossedarms', 'armscrossed', 'impatient', 'waiting'],
  crouch: ['crouch', 'crouching', 'takeoff', 'jumpstart'],
  fly: ['fly', 'flying', 'superman', 'flight'],
  land: ['land', 'landing', 'superherolanding', 'heroland'],
}

/** Maps the model's animation names to Nova clips (`Armature|Waving` → `wave`). */
export function matchClips(clipNames: readonly string[] | null | undefined): Partial<Record<ClipName, string>> {
  const result: Partial<Record<ClipName, string>> = {}
  if (!clipNames) return result
  for (const [clip, aliases] of Object.entries(CLIP_ALIASES) as Array<[ClipName, readonly string[]]>) {
    const found = clipNames.find((name) => aliases.includes(normalizeName(name)))
    if (found) result[clip] = found
  }
  return result
}
