/**
 * Order of the per-frame work (R3F runs `useFrame` callbacks by ascending priority; any positive
 * priority takes over rendering): advance the film, update the stages, then render.
 */
export const FRAME_PRIORITY = {
  director: -30,
  /** camera, sun and time of day */
  stage: -20,
  /** moving details that read the stage state (shuttles, beams) */
  details: -15,
  /** the lake's mirror render, once the scene is up to date */
  reflection: -10,
  render: 1,
} as const
