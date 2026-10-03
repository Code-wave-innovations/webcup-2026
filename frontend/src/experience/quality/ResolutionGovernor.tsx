import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { director } from '../director/director'
import { AdaptiveResolution, computePixelRatio, type QualityProfile } from './quality'

/** Keeps the canvas pixel ratio within the pixel budget, and lowers it if the city runs below 27 fps. */
export function ResolutionGovernor({ profile }: { profile: QualityProfile }) {
  const setDpr = useThree((s) => s.setDpr)
  const size = useThree((s) => s.size)
  const adaptive = useMemo(() => new AdaptiveResolution(), [])
  const [scale, setScale] = useState(adaptive.scale)

  useEffect(() => {
    setDpr(computePixelRatio(profile, size.width, size.height, scale))
  }, [profile, size, scale, setDpr])

  useFrame((_, delta) => {
    if (director.phase !== 'city' || director.arrival < 1) return
    if (adaptive.sample(delta)) setScale(adaptive.scale)
  })

  return null
}
