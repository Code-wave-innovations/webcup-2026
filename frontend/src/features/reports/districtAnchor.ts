import type { AnchorId } from '../../experience/director/frameState'

/**
 * F25: the report beam rises over the district it belongs to.
 * Centre is the central dome, the west is the greenhouse, the east is dome 3,
 * the north is the observatory and the south is the bridge.
 */
export const DISTRICT_ANCHOR: Record<string, AnchorId> = {
  CENTRE: 'central',
  OUEST: 'serre',
  EST: 'trois',
  NORD: 'observatoire',
  SUD: 'pont',
}

export function anchorForDistrict(code: string | null | undefined): AnchorId {
  if (code && code in DISTRICT_ANCHOR) return DISTRICT_ANCHOR[code]
  return 'trois'
}
