/*
 * Rigs Nova's model (a static Meshy mesh: no skeleton, no animation) and ships it optimised.
 *
 *   yarn model:nova [source.glb] [output.glb]
 *
 * 1. Places the skeleton of the bone contract on the anatomy measured from the mesh itself
 *    (limb gaps and centroids, slice by slice).
 * 2. Skins every vertex region by region (helmet, torso, arms, legs) with smooth blends at the joints.
 * 3. Tags the glowing zones (helmet, chest core) in a `_NOVAZONE` attribute and stores the face anchors
 *    (eyes, chin, cheeks) in the root's extras, for the light-based face and the inverse kinematics.
 * 4. Optimises: WebP textures at 1024 px, Meshopt geometry.
 */
import { Document, NodeIO, type Node, type Primitive } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const source = process.argv[2] ?? 'src/assets/Meshy_AI_Nebula_Sentinel_1003104038_texture.glb'
const output = process.argv[3] ?? 'public/models/nova.glb'

type Vec3 = [number, number, number]
type Bone =
  | 'Hips' | 'Spine' | 'Chest' | 'Neck' | 'Head'
  | 'LeftShoulder' | 'LeftArm' | 'LeftForeArm' | 'LeftHand'
  | 'RightShoulder' | 'RightArm' | 'RightForeArm' | 'RightHand'
  | 'LeftUpLeg' | 'LeftLeg' | 'LeftFoot' | 'RightUpLeg' | 'RightLeg' | 'RightFoot'

const PARENT: Record<Bone, Bone | null> = {
  Hips: null, Spine: 'Hips', Chest: 'Spine', Neck: 'Chest', Head: 'Neck',
  LeftShoulder: 'Chest', LeftArm: 'LeftShoulder', LeftForeArm: 'LeftArm', LeftHand: 'LeftForeArm',
  RightShoulder: 'Chest', RightArm: 'RightShoulder', RightForeArm: 'RightArm', RightHand: 'RightForeArm',
  LeftUpLeg: 'Hips', LeftLeg: 'LeftUpLeg', LeftFoot: 'LeftLeg',
  RightUpLeg: 'Hips', RightLeg: 'RightUpLeg', RightFoot: 'RightLeg',
}
const BONES = Object.keys(PARENT) as Bone[]

/** Heights of the joints as a fraction of the model's height, read off the slices and the side view. */
const LEVEL = {
  hips: 0.47, spine: 0.56, chest: 0.68, neck: 0.835, head: 0.875,
  shoulder: 0.79, elbow: 0.62, wrist: 0.49, handTip: 0.425,
  hip: 0.455, knee: 0.27, ankle: 0.075,
  crotch: 0.43,
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const document: Document = await io.read(source)
const root = document.getRoot()
const mesh = root.listMeshes()[0]
const primitive: Primitive = mesh.listPrimitives()[0]
const position = primitive.getAttribute('POSITION')!
const count = position.getCount()
const P: Vec3[] = Array.from({ length: count }, (_, i) => position.getElement(i, [0, 0, 0]) as Vec3)

let minY = Infinity
let maxY = -Infinity
for (const p of P) {
  minY = Math.min(minY, p[1])
  maxY = Math.max(maxY, p[1])
}
const H = maxY - minY
const level = (h: number) => minY + h * H
const heightOf = (p: Vec3) => (p[1] - minY) / H

/** Gap between the torso and an arm in a horizontal slice (arms hang apart from the body down to the hands). */
function armGap(h: number): number {
  const xs = P.filter((p) => Math.abs(heightOf(p) - h) < 0.0125 && p[0] > 0).map((p) => p[0]).sort((a, b) => a - b)
  let best = { size: 0, at: 0.24 }
  for (let i = 1; i < xs.length; i++) {
    const size = xs[i] - xs[i - 1]
    if (size > best.size && xs[i - 1] > 0.08) best = { size, at: (xs[i] + xs[i - 1]) / 2 }
  }
  return best.size > 0.02 ? best.at : 0.24
}
const GAP_LEVELS = Array.from({ length: 13 }, (_, k) => LEVEL.handTip + k * ((0.7 - LEVEL.handTip) / 12))
const GAPS = GAP_LEVELS.map(armGap)
const gapAt = (h: number) => {
  if (h <= GAP_LEVELS[0]) return GAPS[0]
  for (let k = 1; k < GAP_LEVELS.length; k++) {
    if (h <= GAP_LEVELS[k]) {
      const t = (h - GAP_LEVELS[k - 1]) / (GAP_LEVELS[k] - GAP_LEVELS[k - 1])
      return GAPS[k - 1] + (GAPS[k] - GAPS[k - 1]) * t
    }
  }
  return GAPS[GAPS.length - 1]
}

const centroid = (filter: (p: Vec3, h: number) => boolean): Vec3 => {
  const sum: Vec3 = [0, 0, 0]
  let n = 0
  for (const p of P) {
    if (!filter(p, heightOf(p))) continue
    sum[0] += p[0]
    sum[1] += p[1]
    sum[2] += p[2]
    n++
  }
  return n ? [sum[0] / n, sum[1] / n, sum[2] / n] : [0, 0, 0]
}

// joints measured on the left side (+X), mirrored for the right
const armSlice = (h: number) => centroid((p, ph) => Math.abs(ph - h) < 0.01 && p[0] > gapAt(h))
const legSlice = (h: number, maxZ = Infinity) => centroid((p, ph) => Math.abs(ph - h) < 0.01 && p[0] > 0.015 && p[2] < maxZ)
const torso = centroid((p, ph) => Math.abs(ph - LEVEL.spine) < 0.02 && Math.abs(p[0]) < 0.15)
const neck = centroid((p, ph) => Math.abs(ph - LEVEL.neck) < 0.01 && Math.abs(p[0]) < 0.1)
const elbow = armSlice(LEVEL.elbow)
const wrist = armSlice(LEVEL.wrist)
const upperArm = armSlice(0.69)
const knee = legSlice(LEVEL.knee)
const ankle = legSlice(LEVEL.ankle, 0.02)
const thigh = legSlice(0.41)

const LEFT: Partial<Record<Bone, Vec3>> = {
  Hips: [0, level(LEVEL.hips), torso[2]],
  Spine: [0, level(LEVEL.spine), torso[2]],
  Chest: [0, level(LEVEL.chest), torso[2]],
  Neck: [0, level(LEVEL.neck), neck[2]],
  Head: [0, level(LEVEL.head), neck[2]],
  LeftShoulder: [0.07, level(LEVEL.shoulder), upperArm[2]],
  LeftArm: [Math.min(upperArm[0], 0.23), level(LEVEL.shoulder), upperArm[2]],
  LeftForeArm: [elbow[0], level(LEVEL.elbow), elbow[2]],
  LeftHand: [wrist[0], level(LEVEL.wrist), wrist[2]],
  LeftUpLeg: [thigh[0], level(LEVEL.hip), thigh[2]],
  LeftLeg: [knee[0], level(LEVEL.knee), knee[2]],
  LeftFoot: [ankle[0], level(LEVEL.ankle), ankle[2]],
}
const JOINT = {} as Record<Bone, Vec3>
for (const bone of BONES) {
  const own = LEFT[bone]
  if (own) JOINT[bone] = own
  else {
    const mirror = LEFT[bone.replace('Right', 'Left') as Bone]!
    JOINT[bone] = [-mirror[0], mirror[1], mirror[2]]
  }
}

/** Weights of one vertex: region (arm, leg, torso) blended at the shoulders and hips, then along each chain. */
function skin(p: Vec3): Array<[Bone, number]> {
  const h = heightOf(p)
  const side = p[0] >= 0 ? 'Left' : 'Right'
  const ax = Math.abs(p[0])
  const weights = new Map<Bone, number>()
  const add = (bone: Bone, w: number) => w > 1e-4 && weights.set(bone, (weights.get(bone) ?? 0) + w)

  // arm membership: beyond the torso/arm gap below the armpit, a ramp across the shoulder pad above it
  let arm = 0
  if (h > LEVEL.handTip - 0.01 && h < 0.7) arm = smooth(gapAt(h) - 0.012, gapAt(h) + 0.012, ax)
  else if (h >= 0.7 && h < 0.86) arm = smooth(0.13, 0.23, ax) * (1 - smooth(0.8, 0.86, h))
  // leg membership: below the crotch, fading into the hips around it
  const leg = (1 - arm) * (1 - smooth(LEVEL.crotch - 0.02, LEVEL.hips + 0.04, h))
  const body = 1 - arm - leg

  if (arm > 0) {
    const upper = smooth(LEVEL.elbow - 0.025, LEVEL.elbow + 0.025, h)
    const hand = 1 - smooth(LEVEL.wrist - 0.02, LEVEL.wrist + 0.01, h)
    add(`${side}Arm`, arm * upper)
    add(`${side}ForeArm`, arm * (1 - upper) * (1 - hand))
    add(`${side}Hand`, arm * (1 - upper) * hand)
  }
  if (leg > 0) {
    const thighW = smooth(LEVEL.knee - 0.025, LEVEL.knee + 0.025, h)
    const foot = 1 - smooth(LEVEL.ankle - 0.015, LEVEL.ankle + 0.02, h)
    add(`${side}UpLeg`, leg * thighW)
    add(`${side}Leg`, leg * (1 - thighW) * (1 - foot))
    add(`${side}Foot`, leg * (1 - thighW) * foot)
  }
  if (body > 0) {
    const spine = smooth(0.48, 0.54, h)
    const chest = smooth(0.59, 0.65, h)
    const neckW = smooth(0.82, 0.85, h)
    const head = smooth(0.865, 0.885, h)
    add('Hips', body * (1 - spine))
    add('Spine', body * spine * (1 - chest))
    add('Chest', body * chest * (1 - neckW))
    add('Neck', body * neckW * (1 - head))
    add('Head', body * head)
  }
  return [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
}

// skeleton nodes (rest pose: identity rotations, arms in the model's slight A-pose)
const novaRoot = document.createNode('Nova')
const joints = {} as Record<Bone, Node>
for (const bone of BONES) joints[bone] = document.createNode(bone)
for (const bone of BONES) {
  const parent = PARENT[bone]
  const at = JOINT[bone]
  const from = parent ? JOINT[parent] : ([0, 0, 0] as Vec3)
  joints[bone].setTranslation([at[0] - from[0], at[1] - from[1], at[2] - from[2]])
  ;(parent ? joints[parent] : novaRoot).addChild(joints[bone])
}

const jointIndex = new Uint16Array(count * 4)
const jointWeight = new Float32Array(count * 4)
const zone = new Float32Array(count)
const zoneCounts = { helmet: 0, core: 0 }
for (let i = 0; i < count; i++) {
  const influences = skin(P[i])
  const total = influences.reduce((s, [, w]) => s + w, 0) || 1
  influences.forEach(([bone, w], k) => {
    jointIndex[i * 4 + k] = BONES.indexOf(bone)
    jointWeight[i * 4 + k] = w / total
  })
  const h = heightOf(P[i])
  const p = P[i]
  if (h > 0.878) {
    zone[i] = 0.5
    zoneCounts.helmet++
  } else if (h > 0.7 && h < 0.79 && Math.abs(p[0]) < 0.09 && p[2] > 0.04) {
    zone[i] = 1
    zoneCounts.core++
  }
}

const buffer = root.listBuffers()[0]
primitive.setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(jointIndex).setBuffer(buffer))
primitive.setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(jointWeight).setBuffer(buffer))
primitive.setAttribute('_NOVAZONE', document.createAccessor().setType('SCALAR').setArray(zone).setBuffer(buffer))

const inverseBind = new Float32Array(BONES.length * 16)
BONES.forEach((bone, j) => {
  const [x, y, z] = JOINT[bone]
  inverseBind.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1], j * 16)
})
const skinDef = document
  .createSkin('NovaSkin')
  .setSkeleton(joints.Hips)
  .setInverseBindMatrices(document.createAccessor().setType('MAT4').setArray(inverseBind).setBuffer(buffer))
BONES.forEach((bone) => skinDef.addJoint(joints[bone]))

// replace the scene: Nova → [skeleton, skinned body]
const scene = root.getDefaultScene() ?? root.listScenes()[0]
for (const child of scene.listChildren()) scene.removeChild(child)
const bodyNode = document.createNode('Body').setMesh(mesh).setSkin(skinDef)
mesh.setName('NovaBody')
primitive.getMaterial()?.setName('NovaArmor')
novaRoot.addChild(bodyNode)
scene.addChild(novaRoot)
for (const node of root.listNodes()) if (node.getMesh() === mesh && node !== bodyNode) node.dispose()

// face anchors for the inverse kinematics (hands over the eyes, under the chin), in model units
const frontAt = (x: number, h: number) => {
  let z = -Infinity
  for (const p of P) if (Math.abs(heightOf(p) - h) < 0.006 && Math.abs(p[0] - x) < 0.015) z = Math.max(z, p[2])
  return Number.isFinite(z) ? z : 0.1
}
const anchor = (x: number, h: number): Vec3 => [x, level(h), frontAt(x, h)]
// the helmet's eye line is the violet brow strokes around the diamond, near 94.5 % of the height
novaRoot.setExtras({
  novaFace: {
    eyeL: anchor(0.04, 0.945),
    eyeR: anchor(-0.04, 0.945),
    chin: anchor(0, 0.9),
    cheekL: anchor(0.06, 0.922),
    cheekR: anchor(-0.06, 0.922),
  },
})

await document.transform(
  dedup(),
  prune({ keepAttributes: true }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 88 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
)
await io.write(output, document)

const round = (v: Vec3) => v.map((n) => n.toFixed(3)).join(', ')
console.log(`Nova rigged: ${count} vertices, ${BONES.length} bones, helmet ${zoneCounts.helmet} / core ${zoneCounts.core} glow vertices`)
for (const bone of BONES) console.log(`  ${bone.padEnd(13)} ${round(JOINT[bone])}`)
console.log(`→ ${output}`)
