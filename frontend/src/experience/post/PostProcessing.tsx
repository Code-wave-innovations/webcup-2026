import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing'
import { useEffect, useMemo } from 'react'
import { HalfFloatType, PerspectiveCamera, UnsignedByteType, type Camera } from 'three'
import { useDisposeOnUnmount } from '../../hooks/useDisposeOnUnmount'
import { frameBus } from '../director/frameState'
import { FRAME_PRIORITY } from '../framePriority'
import type { QualityProfile } from '../quality/quality'
import { FilmEffect, type FilmControls } from './FilmEffect'

const disposePipeline = (pipeline: { composer: EffectComposer }) => pipeline.composer.dispose()

interface PostProcessingProps {
  profile: QualityProfile
  /** the camera to render this frame (the film switches between the cockpit and the city) */
  camera: () => Camera | null
  controls: FilmControls
  /** seconds of the current frame, for the DOM overlays that follow the scene */
  frameTime: () => { dt: number; time: number }
}

/** Renders the scene into an HDR buffer (multisampled on capable devices), then develops it with the film look. */
export function PostProcessing({ profile, camera: activeCamera, controls, frameTime }: PostProcessingProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const pipeline = useMemo(() => {
    const placeholder = new PerspectiveCamera()
    const composer = new EffectComposer(gl, {
      frameBufferType: profile.hdr ? HalfFloatType : UnsignedByteType,
      multisampling: profile.msaa,
    })
    const renderPass = new RenderPass(scene, placeholder)
    const film = new FilmEffect(profile.hdr)
    const filmPass = new EffectPass(placeholder, film)
    composer.addPass(renderPass)
    composer.addPass(filmPass)
    return { composer, renderPass, filmPass, film }
  }, [gl, scene, profile])

  useEffect(() => {
    // same CSS size as R3F already applied: this only resizes the composer's buffers to the new drawing buffer
    pipeline.composer.setSize(size.width, size.height, false)
  }, [pipeline, size, dpr])

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __novaPost: pipeline })
  }, [pipeline])
  useDisposeOnUnmount(pipeline, disposePipeline)

  useFrame((_, delta) => {
    const camera = activeCamera()
    if (!camera) return
    pipeline.renderPass.mainCamera = camera
    pipeline.filmPass.mainCamera = camera
    pipeline.film.apply(controls)
    pipeline.composer.render(delta)
    const { dt, time } = frameTime()
    frameBus.emit(dt, time)
  }, FRAME_PRIORITY.render)

  return null
}
