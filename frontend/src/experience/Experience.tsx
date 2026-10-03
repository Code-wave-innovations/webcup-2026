import { Canvas } from '@react-three/fiber'
import { Component, memo, useEffect, type ReactNode } from 'react'
import { director } from './director/director'
import { useDirectorStore } from './director/directorStore'
import { Film } from './Film'
import styles from './Experience.module.css'

function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

function markUnsupported() {
  useDirectorStore.getState().setStatus('unsupported')
}

/** Any failure while building the scene falls back to the painted sky: the site keeps working without 3D. */
class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('3D scene disabled:', error)
    markUnsupported()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Never re-renders: R3F re-applies Canvas props on every render, which would reset the pixel ratio
 * chosen by the resolution governor.
 */
const SceneCanvas = memo(function SceneCanvas() {
  return (
    <Canvas
      flat
      linear
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 1)
        gl.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          markUnsupported()
        })
      }}
    >
      <Film />
    </Canvas>
  )
})

/** The persistent full-screen film behind the interface (one WebGL context for the whole visit). */
export function Experience() {
  const status = useDirectorStore((s) => s.status)

  useEffect(() => {
    if (!supportsWebGL2()) markUnsupported()
    const onPointerMove = (event: PointerEvent) => {
      director.pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      director.pointer.y = (event.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [])

  if (status === 'unsupported') return <div className={styles.fallback} aria-hidden="true" />

  return (
    <div className={styles.stage} data-ready={status === 'ready'} aria-hidden="true">
      <SceneErrorBoundary>
        <SceneCanvas />
      </SceneErrorBoundary>
    </div>
  )
}
