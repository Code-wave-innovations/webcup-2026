import { useEffect, useMemo, type Ref } from 'react'
import { BackSide, CanvasTexture, Vector3, Vector4, type Mesh } from 'three'
import { useCity } from '../CityContext'
import { createWorldMaterial } from '../worldMaterial'
import skyVert from '../glsl/sky.vert.glsl?raw'
import skyFrag from '../glsl/sky.frag.glsl?raw'

const TITLE_FONT = '800 100px "Unbounded Variable", "Arial Black", sans-serif'
const TITLE_WIDTH = 2048
const TITLE_HEIGHT = 800

/** "TERRA NOVA" set full width on two lines, as an alpha mask the sky shader turns into giant letters. */
function drawCityTitle(canvas: HTMLCanvasElement) {
  const c = canvas.getContext('2d')
  if (!c) return
  c.clearRect(0, 0, TITLE_WIDTH, TITLE_HEIGHT)
  c.fillStyle = '#fff'
  c.textBaseline = 'alphabetic'
  c.textAlign = 'center'
  let y = 0
  ;['TERRA', 'NOVA'].forEach((word, line) => {
    c.font = TITLE_FONT
    const size = (100 * 1980) / c.measureText(word).width
    c.font = TITLE_FONT.replace('100px', `${size.toFixed(1)}px`)
    const capHeight = c.measureText(word).actualBoundingBoxAscent || size * 0.72
    y += capHeight + (line ? 46 : 22)
    c.fillText(word, TITLE_WIDTH / 2, y)
  })
}

/** Sky dome: gradient, stars, high veils, the giant planet, a moon and the city's name. Follows the camera. */
export function Sky({ meshRef }: { meshRef: Ref<Mesh> }) {
  const { uniforms, textures } = useCity()
  const title = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = TITLE_WIDTH
    canvas.height = TITLE_HEIGHT
    const texture = new CanvasTexture(canvas)
    texture.anisotropy = 8
    return { canvas, texture }
  }, [])

  const material = useMemo(
    () =>
      createWorldMaterial(
        uniforms,
        skyVert,
        skyFrag,
        {
          tSol: { value: textures.soil },
          tTexte: { value: title.texture },
          uTexte: { value: new Vector4(0.15, 0.228, 0.62, 0.242) },
          uTexteForce: { value: 1 },
          uPlaneteDir: { value: new Vector3(-0.285, 0.375, -0.88).normalize() },
          uPlaneteRayon: { value: 0.25 },
          uLuneDir: { value: new Vector3(0.52, 0.31, -0.8).normalize() },
        },
        { side: BackSide, depthWrite: false, depthTest: false },
      ),
    [uniforms, textures, title],
  )

  useEffect(() => {
    const redraw = () => {
      drawCityTitle(title.canvas)
      title.texture.needsUpdate = true
    }
    redraw()
    // the display font may arrive after the first draw: redraw with the real letterforms
    document.fonts?.load(TITLE_FONT).then(redraw, () => undefined)
  }, [title])

  return (
    <mesh ref={meshRef} material={material} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[1500, 48, 24]} />
    </mesh>
  )
}
