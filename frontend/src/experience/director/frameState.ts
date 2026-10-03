/** A 3D point projected to CSS pixels. */
export interface ScreenPoint {
  x: number
  y: number
  visible: boolean
}

/** City landmarks the interface points at (the luminous line from a panel to its district). */
export type AnchorId = 'central' | 'serre' | 'trois' | 'conseil' | 'pont' | 'observatoire'

const hiddenPoint = (): ScreenPoint => ({ x: -999, y: -999, visible: false })

/**
 * Values the 3D writes every frame for the interface to read: mutated in place, never through React,
 * so following the scene costs no re-render.
 */
export const frameState = {
  anchors: {
    central: hiddenPoint(),
    serre: hiddenPoint(),
    trois: hiddenPoint(),
    conseil: hiddenPoint(),
    pont: hiddenPoint(),
    observatoire: hiddenPoint(),
  } satisfies Record<AnchorId, ScreenPoint>,
  nova: {
    /** top of Nova's head on screen, where the speech bubble attaches */
    head: hiddenPoint(),
    /** Nova's box on screen (the DOM hit zone that makes it clickable and focusable) */
    box: { left: 0, top: 0, width: 0, height: 0, visible: false },
    /** tip of the presenting hand, where the line of light to a district starts */
    finger: hiddenPoint(),
    /** 0 → 1 while Nova holds its arm towards a district */
    pointing: 0,
  },
  /** time of day in the city: 0 late afternoon → 1 night */
  dusk: 0,
}

type FrameListener = (dt: number, time: number) => void
const listeners = new Set<FrameListener>()

/** Lets DOM overlays follow the scene in the same animation frame as the render, after it. */
export const frameBus = {
  subscribe(listener: FrameListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  emit(dt: number, time: number): void {
    listeners.forEach((listener) => listener(dt, time))
  },
}
