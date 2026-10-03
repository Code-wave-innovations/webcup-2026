import {
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three'
import type { BoneName } from './rigContract'

type Vec3 = readonly [number, number, number]

export interface StandIn {
  root: Group
  bones: Record<BoneName, Group>
  visor: Mesh
  /** visor width / height, for the face drawing */
  visorAspect: number
  meshes: Mesh[]
  headTop: number
  dispose(): void
}

/** Joint positions in the rest pose (arms hanging, facing +Z, left side towards +X), Nova 1 unit tall. */
const JOINTS: Record<BoneName, { parent: BoneName | null; at: Vec3 }> = {
  Hips: { parent: null, at: [0, 0.3, 0] },
  Spine: { parent: 'Hips', at: [0, 0.34, 0] },
  Chest: { parent: 'Spine', at: [0, 0.44, 0] },
  Neck: { parent: 'Chest', at: [0, 0.6, 0] },
  Head: { parent: 'Neck', at: [0, 0.63, 0] },
  Antenna: { parent: 'Head', at: [0, 0.94, -0.02] },
  LeftShoulder: { parent: 'Chest', at: [0.13, 0.56, 0] },
  LeftArm: { parent: 'LeftShoulder', at: [0.178, 0.55, 0] },
  LeftForeArm: { parent: 'LeftArm', at: [0.178, 0.405, 0] },
  LeftHand: { parent: 'LeftForeArm', at: [0.178, 0.275, 0] },
  RightShoulder: { parent: 'Chest', at: [-0.13, 0.56, 0] },
  RightArm: { parent: 'RightShoulder', at: [-0.178, 0.55, 0] },
  RightForeArm: { parent: 'RightArm', at: [-0.178, 0.405, 0] },
  RightHand: { parent: 'RightForeArm', at: [-0.178, 0.275, 0] },
  LeftUpLeg: { parent: 'Hips', at: [0.075, 0.29, 0] },
  LeftLeg: { parent: 'LeftUpLeg', at: [0.075, 0.175, 0] },
  LeftFoot: { parent: 'LeftLeg', at: [0.075, 0.06, 0] },
  RightUpLeg: { parent: 'Hips', at: [-0.075, 0.29, 0] },
  RightLeg: { parent: 'RightUpLeg', at: [-0.075, 0.175, 0] },
  RightFoot: { parent: 'RightLeg', at: [-0.075, 0.06, 0] },
}

const HEAD_CENTER: Vec3 = [0, 0.16, 0]
const HEAD_RADIUS = 0.19
const HEAD_SCALE: Vec3 = [1.15, 0.9, 1]
const VISOR_WIDTH = 1.9
const VISOR_HEIGHT = 1.12

/**
 * Nova, built from code while the GLB is being made: a small companion robot in pearl ceramic with
 * graphite joints, a black glass visor for a face, an ember-tipped antenna. Rigid parts on a joint
 * hierarchy named after the bone contract, rest pose = identity rotations.
 */
export function buildStandIn(): StandIn {
  const shell = new MeshPhysicalMaterial({
    color: new Color(0.84, 0.87, 0.9),
    roughness: 0.3,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    iridescence: 0.22,
    iridescenceIOR: 1.35,
    sheen: 0.35,
    sheenColor: new Color(0.62, 0.8, 1),
    envMapIntensity: 1.35,
  })
  const graphite = new MeshPhysicalMaterial({ color: new Color(0.032, 0.037, 0.046), roughness: 0.36, metalness: 0.8, clearcoat: 0.4 })
  const glow = new MeshBasicMaterial({ color: new Color(0.55, 1.9, 2.6) })
  const softGlow = new MeshBasicMaterial({ color: new Color(0.35, 1.2, 1.65) })
  const ember = new MeshBasicMaterial({ color: new Color(3.4, 1.15, 0.32) })
  const visorPlaceholder = new MeshBasicMaterial({ color: 0x000000 })
  const materials: Material[] = [shell, graphite, glow, softGlow, ember, visorPlaceholder]
  const geometries: BufferGeometry[] = []
  const meshes: Mesh[] = []

  const root = new Group()
  root.name = 'Nova'
  const bones = {} as Record<BoneName, Group>
  for (const [name, joint] of Object.entries(JOINTS) as Array<[BoneName, (typeof JOINTS)[BoneName]]>) {
    const group = new Group()
    group.name = name
    const parentAt = joint.parent ? JOINTS[joint.parent].at : ([0, 0, 0] as const)
    group.position.set(joint.at[0] - parentAt[0], joint.at[1] - parentAt[1], joint.at[2] - parentAt[2])
    bones[name] = group
  }
  for (const [name, joint] of Object.entries(JOINTS) as Array<[BoneName, (typeof JOINTS)[BoneName]]>) {
    ;(joint.parent ? bones[joint.parent] : root).add(bones[name])
  }

  const part = (parent: Object3D, geometry: BufferGeometry, material: Material, at: Vec3 = [0, 0, 0], scale?: Vec3, rotation?: Vec3) => {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(...at)
    if (scale) mesh.scale.set(...scale)
    if (rotation) mesh.rotation.set(...rotation)
    mesh.castShadow = true
    mesh.receiveShadow = true
    parent.add(mesh)
    geometries.push(geometry)
    meshes.push(mesh)
    return mesh
  }

  // pelvis and torso: an egg of ceramic, a graphite waist, a lit hexagon on the chest
  part(bones.Hips, new SphereGeometry(0.1, 32, 16), graphite, [0, -0.005, 0], [1.12, 0.62, 0.92])
  const torsoProfile = [
    [0, -0.135], [0.08, -0.13], [0.12, -0.1], [0.147, -0.03], [0.156, 0.035], [0.148, 0.095], [0.12, 0.14], [0.065, 0.163], [0, 0.168],
  ].map(([r, y]) => new Vector2(r, y))
  part(bones.Chest, new LatheGeometry(torsoProfile, 40), shell, [0, 0, 0], [1, 1, 0.86])
  part(bones.Chest, new TorusGeometry(0.129, 0.005, 8, 48), softGlow, [0, -0.085, 0], [1, 1, 0.86], [Math.PI / 2, 0, 0])
  part(bones.Chest, new CylinderGeometry(0.032, 0.032, 0.012, 6), graphite, [0, 0.04, 0.131], undefined, [Math.PI / 2 - 0.12, Math.PI / 6, 0])
  part(bones.Chest, new CircleGeometry(0.026, 6), glow, [0, 0.0405, 0.1374], undefined, [-0.12, 0, Math.PI / 6])
  part(bones.Spine, new CylinderGeometry(0.085, 0.095, 0.08, 28), graphite, [0, 0.0, 0])

  // neck and head: pearl helmet, black glass visor, glowing ear pods, antenna with an ember tip
  part(bones.Neck, new CylinderGeometry(0.032, 0.04, 0.06, 20), graphite, [0, 0.02, 0])
  part(bones.Head, new SphereGeometry(HEAD_RADIUS, 48, 32), shell, HEAD_CENTER, HEAD_SCALE)
  const visor = part(
    bones.Head,
    new SphereGeometry(HEAD_RADIUS * 1.012, 64, 32, Math.PI / 2 - VISOR_WIDTH / 2, VISOR_WIDTH, Math.PI / 2 - VISOR_HEIGHT / 2, VISOR_HEIGHT),
    visorPlaceholder,
    HEAD_CENTER,
    HEAD_SCALE,
  )
  visor.castShadow = false
  for (const side of [-1, 1]) {
    const ear: Vec3 = [side * 0.214, HEAD_CENTER[1], 0]
    part(bones.Head, new CylinderGeometry(0.052, 0.052, 0.04, 28), graphite, ear, undefined, [0, 0, Math.PI / 2])
    part(bones.Head, new TorusGeometry(0.036, 0.006, 8, 32), glow, [ear[0] + side * 0.021, ear[1], 0], undefined, [0, Math.PI / 2, 0])
  }
  part(bones.Antenna, new CylinderGeometry(0.007, 0.009, 0.075, 10), graphite, [0, 0.0375, 0])
  part(bones.Antenna, new SphereGeometry(0.02, 20, 12), ember, [0, 0.085, 0])

  // arms: graphite shoulder and elbow joints, ceramic segments, rounded mitten hands
  for (const side of ['Left', 'Right'] as const) {
    const sign = side === 'Left' ? 1 : -1
    part(bones[`${side}Arm`], new SphereGeometry(0.046, 24, 16), graphite)
    part(bones[`${side}Arm`], new CapsuleGeometry(0.031, 0.094, 6, 16), shell, [0, -0.074, 0])
    part(bones[`${side}ForeArm`], new SphereGeometry(0.034, 20, 12), graphite)
    part(bones[`${side}ForeArm`], new CapsuleGeometry(0.029, 0.084, 6, 16), shell, [0, -0.066, 0])
    part(bones[`${side}Hand`], new SphereGeometry(0.042, 24, 16), shell, [0, -0.04, 0], [0.86, 1.08, 0.8])
    part(bones[`${side}Hand`], new SphereGeometry(0.016, 12, 8), graphite, [-sign * 0.006, -0.026, 0.032])
    part(bones[`${side}UpLeg`], new CapsuleGeometry(0.037, 0.072, 6, 16), shell, [0, -0.056, 0])
    part(bones[`${side}Leg`], new SphereGeometry(0.035, 20, 12), graphite)
    part(bones[`${side}Leg`], new CapsuleGeometry(0.034, 0.07, 6, 16), shell, [0, -0.056, 0])
    part(bones[`${side}Foot`], new SphereGeometry(0.05, 28, 16), shell, [0, -0.028, 0.026], [1, 0.62, 1.5])
    part(bones[`${side}Foot`], new CircleGeometry(0.028, 24), glow, [0, -0.0585, 0.026], undefined, [Math.PI / 2, 0, 0])
  }

  return {
    root,
    bones,
    visor,
    visorAspect: (VISOR_WIDTH * HEAD_SCALE[0]) / (VISOR_HEIGHT * HEAD_SCALE[1]),
    meshes,
    headTop: JOINTS.Head.at[1] + HEAD_CENTER[1] + HEAD_RADIUS * HEAD_SCALE[1],
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
