import { Vector3 } from 'three'
import type { AnchorId } from '../director/frameState'
import { COUNCIL_TOWER, DOME_BASE, DOME_FLATTEN, DOMES, OBSERVATORY } from './cityConfig'

const domeTop = (id: string) => {
  const dome = DOMES.find((d) => d.id === id)
  if (!dome) return new Vector3(0, DOME_BASE, 0)
  return new Vector3(dome.x, DOME_BASE + dome.r * DOME_FLATTEN, dome.z)
}

/** Landmarks the interface links its panels to, and Nova points at (projected to the screen every frame). */
export const ANCHORS: Record<AnchorId, Vector3> = {
  central: domeTop('central'),
  serre: domeTop('serre'),
  trois: domeTop('trois'),
  conseil: new Vector3(COUNCIL_TOWER.x, 0.5 + COUNCIL_TOWER.h * 0.86, COUNCIL_TOWER.z),
  pont: new Vector3(4, 4.4, 60),
  // top of the Observatory's glass cap
  observatoire: new Vector3(OBSERVATORY.x, 0.5 + OBSERVATORY.h * OBSERVATORY.capAt + OBSERVATORY.radius * 2 * OBSERVATORY.capRadius * 0.9, OBSERVATORY.z),
}

/** Holographic markers floating over the districts, this high above their landmark. */
export const MARKERS: ReadonlyArray<{ anchor: AnchorId; lift: number }> = [
  { anchor: 'central', lift: 3.4 },
  { anchor: 'trois', lift: 3 },
  { anchor: 'serre', lift: 3 },
  { anchor: 'conseil', lift: 9 },
  { anchor: 'observatoire', lift: 4 },
]
