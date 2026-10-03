import { Box3, Group, Vector3, VectorKeyframeTrack, type AnimationClip, type Mesh, type Object3D, type SkinnedMesh } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { buildClip } from '../animation/buildClip'
import { POSE_LIBRARY } from '../animation/poseLibrary'
import { solveReaches, type FaceAnchors } from '../animation/solveReach'
import { EyeMeshFaceDriver, GlowFaceDriver, MorphFaceDriver, NoFaceDriver, VisorFaceDriver, type FaceDriver } from '../face/faceDrivers'
import { matchBones, matchClips, normalizeName } from './aliases'
import { buildStandIn } from './buildStandIn'
import { CLIPS, REQUIRED_BONES, type BoneName, type ClipName, type RigReport } from './rigContract'
import type { FaceAnchor } from '../animation/poseLibrary'
import { relaxArms, RigSpace } from './RigSpace'

/** A Nova ready to animate: normalised (1 unit tall, feet at 0, facing +Z), every clip available. */
export interface NovaRig {
  root: Group
  bones: Partial<Record<BoneName, Object3D>>
  space: RigSpace
  clips: Record<ClipName, AnimationClip>
  face: FaceDriver
  report: RigReport
  /** from the Head bone up to the top of the head (normalised units), where the speech bubble attaches */
  headOffset: number
  /** height of the hips in the rest pose (normalised units): a jump lifts them above it */
  hipsHeight: number
  /** points of the face the hands can reach, in the Head bone's frame */
  faceAnchors: FaceAnchors | null
  meshes: Mesh[]
  dispose(): void
}

/** Uses the model's clips where they exist and generates the others on its skeleton from the gesture library. */
function completeClips(
  own: Partial<Record<ClipName, AnimationClip>>,
  space: RigSpace,
  bones: Partial<Record<BoneName, Object3D>>,
  anchors: FaceAnchors | null,
): { clips: Record<ClipName, AnimationClip>; generated: ClipName[] } {
  const generated: ClipName[] = []
  const clips = {} as Record<ClipName, AnimationClip>
  for (const name of CLIPS) {
    const existing = own[name]
    if (existing) {
      clips[name] = existing
    } else {
      clips[name] = buildClip(name, solveReaches(POSE_LIBRARY[name], space, bones, anchors), space, bones)
      generated.push(name)
    }
  }
  return { clips, generated }
}

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

/** The stand-in's visor: where the drawn eyes, chin and cheeks are, in the Head joint's frame. */
const STAND_IN_FACE: FaceAnchors = {
  eyeL: v(0.038, 0.172, 0.189),
  eyeR: v(-0.038, 0.172, 0.189),
  chin: v(0, 0.07, 0.17),
  cheekL: v(0.1, 0.1, 0.15),
  cheekR: v(-0.1, 0.1, 0.15),
}

/** Face anchors measured by the rigging script (`extras.novaFace`, model units), or estimated from the head. */
function faceAnchors(scene: Object3D, head: Object3D | undefined, headOffset: number): FaceAnchors | null {
  if (!head) return null
  let measured: Record<string, number[]> | undefined
  let owner: Object3D | undefined
  scene.traverse((o) => {
    if (!measured && o.userData.novaFace) {
      measured = o.userData.novaFace as Record<string, number[]>
      owner = o
    }
  })
  const toHead = (world: Vector3) => head.worldToLocal(world)
  if (measured && owner) {
    const at = (name: FaceAnchor) => toHead(owner!.localToWorld(v(...(measured![name] as [number, number, number]))))
    return { eyeL: at('eyeL'), eyeR: at('eyeR'), chin: at('chin'), cheekL: at('cheekL'), cheekR: at('cheekR') }
  }
  const origin = head.getWorldPosition(new Vector3())
  const point = (x: number, y: number, z: number) => toHead(origin.clone().add(v(x, y * headOffset, z * headOffset)))
  return { eyeL: point(0.03, 0.45, 0.55), eyeR: point(-0.03, 0.45, 0.55), chin: point(0, 0.12, 0.5), cheekL: point(0.05, 0.25, 0.5), cheekR: point(-0.05, 0.25, 0.5) }
}

/** The procedural stand-in: same bones, same clips, a visor face. */
export function createStandInRig(): NovaRig {
  const standIn = buildStandIn()
  const space = new RigSpace(standIn.root, standIn.bones)
  const { clips, generated } = completeClips({}, space, standIn.bones, STAND_IN_FACE)
  const face = new VisorFaceDriver(standIn.visor, standIn.visorAspect)
  const root = new Group()
  root.add(standIn.root)
  return {
    root,
    bones: standIn.bones,
    space,
    clips,
    face,
    headOffset: standIn.headTop - standIn.bones.Head.getWorldPosition(new Vector3()).y,
    hipsHeight: standIn.bones.Hips.getWorldPosition(new Vector3()).y,
    faceAnchors: STAND_IN_FACE,
    meshes: standIn.meshes,
    report: {
      source: 'Nova provisoire (code)',
      bones: Object.fromEntries(Object.keys(standIn.bones).map((b) => [b, b])),
      missingBones: [],
      clips: {},
      generatedClips: generated,
      face: 'visor',
      nativeHeight: 1,
    },
    dispose() {
      face.dispose()
      standIn.dispose()
    },
  }
}

/** Keeps a walk cycle in place: the scroll moves Nova, not the animation (drops the hips' horizontal travel). */
function stripRootMotion(clip: AnimationClip, hipsName: string): AnimationClip {
  const result = clip.clone()
  result.tracks = result.tracks.map((track) => {
    if (track.name !== `${hipsName}.position` || !(track instanceof VectorKeyframeTrack)) return track
    const values = track.values.slice()
    for (let i = 0; i < values.length; i += 3) {
      values[i] = track.values[0]
      values[i + 2] = track.values[2]
    }
    return new VectorKeyframeTrack(track.name, track.times, values)
  })
  return result
}

function detectFace(scene: Object3D, meshes: Mesh[], bones: Partial<Record<BoneName, Object3D>>): FaceDriver {
  const visor = meshes.find((m) => /^(face|visor|visiere|screen)$/.test(normalizeName(m.name)))
  if (visor) {
    visor.geometry.computeBoundingBox()
    const size = visor.geometry.boundingBox!.getSize(new Vector3())
    return new VisorFaceDriver(visor, size.x / Math.max(size.y, 1e-6))
  }
  if (GlowFaceDriver.detect(meshes)) return new GlowFaceDriver(meshes)
  if (MorphFaceDriver.detect(meshes)) return new MorphFaceDriver(meshes)
  const eye = (pattern: RegExp) => {
    let found: Object3D | undefined
    scene.traverse((o) => {
      if (!found && o !== bones.Head && pattern.test(normalizeName(o.name))) found = o
    })
    return found
  }
  const left = eye(/^(eyel|lefteye|eyeleft)$/)
  const right = eye(/^(eyer|righteye|eyeright)$/)
  if (left && right) return new EyeMeshFaceDriver(left, right)
  return new NoFaceDriver()
}

/**
 * Wraps a delivered GLB: clones it (skinned meshes included), recognises the bones and clips by name,
 * lowers T-pose arms, normalises it to Nova's size and fills in the missing clips.
 */
export function createGltfRig(gltf: { scene: Object3D; animations: AnimationClip[] }, source: string): NovaRig {
  const scene = cloneSkinned(gltf.scene)
  const fit = new Group()
  fit.add(scene)
  const root = new Group()
  root.add(fit)

  const names: string[] = []
  const meshes: Mesh[] = []
  scene.traverse((o) => {
    if (o.name) names.push(o.name)
    if ((o as Mesh).isMesh) {
      const mesh = o as Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true
      if ((o as SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false
      meshes.push(mesh)
    }
  })
  const boneNames = matchBones(names)
  const bones: Partial<Record<BoneName, Object3D>> = {}
  for (const [bone, name] of Object.entries(boneNames) as Array<[BoneName, string]>) {
    const node = scene.getObjectByName(name)
    if (node) bones[bone] = node
  }

  // normalise: 1 unit tall, feet on the ground, centred
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(scene, true)
  const nativeHeight = Math.max(box.max.y - box.min.y, 1e-6)
  const scale = 1 / nativeHeight
  const center = box.getCenter(new Vector3())
  fit.scale.setScalar(scale)
  fit.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
  root.updateMatrixWorld(true)
  const headY = bones.Head ? root.worldToLocal(bones.Head.getWorldPosition(new Vector3())).y : 0.85
  const anchors = faceAnchors(scene, bones.Head, Math.max(0.05, 1 - headY))
  relaxArms(root, bones)

  const space = new RigSpace(root, bones)
  const clipNames = matchClips(gltf.animations.map((c) => c.name))
  const own: Partial<Record<ClipName, AnimationClip>> = {}
  for (const [clip, name] of Object.entries(clipNames) as Array<[ClipName, string]>) {
    const animation = gltf.animations.find((a) => a.name === name)
    if (animation) own[clip] = clip === 'walk' && bones.Hips ? stripRootMotion(animation, bones.Hips.name) : animation
  }
  const { clips, generated } = completeClips(own, space, bones, anchors)
  const face = detectFace(scene, meshes, bones)

  return {
    root,
    bones,
    space,
    clips,
    face,
    headOffset: Math.max(0.05, 1 - headY),
    hipsHeight: bones.Hips?.getWorldPosition(new Vector3()).y ?? 0.5,
    faceAnchors: anchors,
    meshes,
    report: {
      source,
      bones: boneNames,
      missingBones: REQUIRED_BONES.filter((b) => !bones[b]),
      clips: clipNames,
      generatedClips: generated,
      face: face.mode,
      nativeHeight,
    },
    dispose() {
      face.dispose()
    },
  }
}
