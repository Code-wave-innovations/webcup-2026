import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { director } from '../director/director'
import { FRAME_PRIORITY } from '../framePriority'
import { AdaptiveResolution, computePixelRatio, GpuFrameTimer, type QualityProfile } from './quality'

/** Keeps the canvas pixel ratio within the pixel budget, and lowers it if the city runs below 27 fps because of the GPU. */
export function ResolutionGovernor({ profile }: { profile: QualityProfile }) {
  const setDpr = useThree((s) => s.setDpr)
  const size = useThree((s) => s.size)
  const gl = useThree((s) => s.gl)
  const adaptive = useMemo(() => new AdaptiveResolution(), [])
  const timer = useMemo(() => new GpuFrameTimer(gl.getContext() as WebGL2RenderingContext), [gl])
  const [scale, setScale] = useState(adaptive.scale)

  useEffect(() => {
    setDpr(computePixelRatio(profile, size.width, size.height, scale))
  }, [profile, size, scale, setDpr])

  useEffect(() => () => timer.dispose(), [timer])

  // the GPU timer brackets the whole frame: from before the director to after the post-processing
  const watching = () => director.inCity && director.arrival >= 1
  useFrame(() => watching() && timer.begin(), FRAME_PRIORITY.director - 1)
  useFrame(() => timer.end(), FRAME_PRIORITY.render + 1)

  useFrame((_, delta) => {
    if (!watching()) return
    if (adaptive.sample(delta, timer.seconds)) setScale(adaptive.scale)
  })

  return null
}
