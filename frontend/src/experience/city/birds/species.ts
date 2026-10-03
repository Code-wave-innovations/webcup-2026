import type { Planform } from './birdGeometry'

export type SpeciesId = 'eagle' | 'goose' | 'gull' | 'swallow'

type Rgb = readonly [number, number, number]

/** Wing angles in radians: shoulder (dihedral, up > 0), wrist (hand relative to arm), sweep (tips back > 0). */
interface WingPose {
  shoulder: number
  wrist: number
  sweep: number
}

/** How a species looks and beats its wings; how it flies is up to its flock (flight.ts). */
export interface Species {
  /** wingspan in world units */
  span: number
  /** cruising speed, world units per second */
  speed: number
  /** wingbeats per second */
  frequency: number
  planform: Planform
  /** wings at rest, gliding */
  glide: WingPose
  /** wingbeat amplitudes; `lag` delays the hand behind the arm, `extend` unfolds the glide sweep, `bob` lifts the body */
  beat: WingPose & { lag: number; extend: number; bob: number }
  /** linear albedos; the primaries take `tips` beyond `tipsFrom` of the half-span */
  colors: { upper: Rgb; under: Rgb; tips: Rgb; tipsFrom: number; head: Rgb; tail: Rgb }
}

/** A tail fanned from `z0` to `z1`, from `halfBase` to `halfEnd` wide, its end edge bulging by `bulge`. */
function fanTail(z0: number, z1: number, halfBase: number, halfEnd: number, bulge: number): number[] {
  const rim: Array<[number, number]> = [[-halfBase, z0]]
  for (let i = 0; i <= 6; i++) {
    const t = i / 3 - 1
    rim.push([t * halfEnd, z1 - bulge * (1 - t * t)])
  }
  rim.push([halfBase, z0])
  const triangles: number[] = []
  for (let i = 0; i + 1 < rim.length; i++) triangles.push(0, z0 + 0.01, ...rim[i], ...rim[i + 1])
  return triangles
}

export const SPECIES: Record<SpeciesId, Species> = {
  // bald eagle: broad plank wings ending in slotted primaries, white head and tail; soars, rarely flaps
  eagle: {
    span: 1.9,
    speed: 5,
    frequency: 2.1,
    planform: {
      root: 0.035,
      arm: 0.19,
      wing: [
        { r: 0, lead: 0.065, trail: -0.105 },
        { r: 0.09, lead: 0.072, trail: -0.11 },
        { r: 0.19, lead: 0.07, trail: -0.1 },
        { r: 0.3, lead: 0.055, trail: -0.088 },
      ],
      fingers: { count: 6, length: 0.15, spread: 0.075 },
      body: [[0.215, 0], [0.19, 0.016], [0.16, 0.026], [0.12, 0.03], [0.06, 0.048], [-0.04, 0.045], [-0.14, 0.03], [-0.2, 0.016]],
      headFrom: 0.11,
      tail: fanTail(-0.17, -0.34, 0.035, 0.075, 0.02),
    },
    glide: { shoulder: 0.13, wrist: 0.06, sweep: 0.06 },
    beat: { shoulder: 0.55, wrist: 0.35, sweep: 0.3, lag: 0.7, extend: 0.4, bob: 0.025 },
    colors: {
      upper: [0.045, 0.03, 0.018],
      under: [0.055, 0.036, 0.022],
      tips: [0.02, 0.015, 0.012],
      tipsFrom: 0.72,
      head: [0.6, 0.58, 0.52],
      tail: [0.6, 0.58, 0.52],
    },
  },
  // Canada goose: long neck stretched forward, pointed wings, steady deep beats
  goose: {
    span: 1.35,
    speed: 8,
    frequency: 2.5,
    planform: {
      root: 0.045,
      arm: 0.18,
      wing: [
        { r: 0, lead: 0.055, trail: -0.1 },
        { r: 0.09, lead: 0.058, trail: -0.095 },
        { r: 0.18, lead: 0.055, trail: -0.082 },
        { r: 0.28, lead: 0.035, trail: -0.07 },
        { r: 0.37, lead: 0.012, trail: -0.052 },
        { r: 0.455, lead: -0.018, trail: -0.034 },
      ],
      body: [[0.43, 0], [0.4, 0.012], [0.37, 0.022], [0.34, 0.016], [0.24, 0.017], [0.15, 0.03], [0.07, 0.058], [-0.04, 0.066], [-0.14, 0.05], [-0.21, 0.026], [-0.24, 0.008]],
      headFrom: 0.16,
      tail: fanTail(-0.19, -0.27, 0.03, 0.05, 0.015),
    },
    glide: { shoulder: 0.04, wrist: -0.02, sweep: 0.1 },
    beat: { shoulder: 0.62, wrist: 0.32, sweep: 0.4, lag: 0.55, extend: 0.5, bob: 0.03 },
    colors: {
      upper: [0.11, 0.09, 0.07],
      under: [0.3, 0.27, 0.22],
      tips: [0.035, 0.03, 0.028],
      tipsFrom: 0.7,
      head: [0.012, 0.012, 0.012],
      tail: [0.015, 0.015, 0.015],
    },
  },
  // herring gull: long narrow wings held in an M (arm raised, hand drooping), grey back, black tips
  gull: {
    span: 1.15,
    speed: 5.5,
    frequency: 2.9,
    planform: {
      root: 0.03,
      arm: 0.2,
      wing: [
        { r: 0, lead: 0.05, trail: -0.075 },
        { r: 0.1, lead: 0.053, trail: -0.07 },
        { r: 0.2, lead: 0.056, trail: -0.06 },
        { r: 0.31, lead: 0.03, trail: -0.058 },
        { r: 0.4, lead: 0, trail: -0.048 },
        { r: 0.47, lead: -0.03, trail: -0.042 },
      ],
      body: [[0.21, 0], [0.185, 0.008], [0.17, 0.018], [0.13, 0.022], [0.06, 0.038], [-0.04, 0.036], [-0.12, 0.022], [-0.16, 0.01]],
      headFrom: 1,
      tail: fanTail(-0.12, -0.2, 0.03, 0.045, 0.004),
    },
    glide: { shoulder: 0.2, wrist: -0.3, sweep: 0.14 },
    beat: { shoulder: 0.5, wrist: 0.42, sweep: 0.32, lag: 0.6, extend: 0.6, bob: 0.02 },
    colors: {
      upper: [0.36, 0.38, 0.41],
      under: [0.7, 0.7, 0.68],
      tips: [0.012, 0.012, 0.014],
      tipsFrom: 0.84,
      head: [0.72, 0.72, 0.7],
      tail: [0.72, 0.72, 0.7],
    },
  },
  // barn swallow: short arm, long scythe hand swept back in glides, forked tail streamers, quick beats
  swallow: {
    span: 0.62,
    speed: 10,
    frequency: 6.5,
    planform: {
      root: 0.035,
      arm: 0.11,
      wing: [
        { r: 0, lead: 0.05, trail: -0.06 },
        { r: 0.055, lead: 0.05, trail: -0.056 },
        { r: 0.11, lead: 0.046, trail: -0.046 },
        { r: 0.24, lead: 0.022, trail: -0.036 },
        { r: 0.36, lead: -0.004, trail: -0.03 },
        { r: 0.465, lead: -0.036, trail: -0.042 },
      ],
      body: [[0.12, 0], [0.105, 0.016], [0.08, 0.026], [0.03, 0.033], [-0.04, 0.028], [-0.1, 0.014], [-0.12, 0.006]],
      headFrom: 1,
      // forked: a notch between two long streamers
      tail: [
        -0.022, -0.09, 0.022, -0.09, 0, -0.16,
        0.022, -0.09, 0.062, -0.33, 0.034, -0.22,
        0.022, -0.09, 0.034, -0.22, 0, -0.16,
        -0.022, -0.09, 0, -0.16, -0.034, -0.22,
        -0.022, -0.09, -0.034, -0.22, -0.062, -0.33,
      ],
    },
    glide: { shoulder: 0.02, wrist: -0.06, sweep: 0.5 },
    beat: { shoulder: 0.75, wrist: 0.3, sweep: 0.2, lag: 0.45, extend: 0.75, bob: 0.02 },
    colors: {
      upper: [0.012, 0.016, 0.04],
      under: [0.5, 0.4, 0.3],
      tips: [0.01, 0.012, 0.03],
      tipsFrom: 0.9,
      head: [0.012, 0.016, 0.04],
      tail: [0.012, 0.016, 0.04],
    },
  },
}

export const SPECIES_IDS = Object.keys(SPECIES) as SpeciesId[]
