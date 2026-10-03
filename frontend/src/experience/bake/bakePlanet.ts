import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MirroredRepeatWrapping,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
  type Wrapping,
} from 'three'
import valueNoise from '../glsl/valueNoise.glsl?raw'
import fbm from '../glsl/fbm.glsl?raw'
import fullscreenVert from '../glsl/fullscreen.vert.glsl?raw'
import planet from './glsl/planet.glsl?raw'
import soilFrag from './glsl/soil.frag.glsl?raw'
import reliefFrag from './glsl/relief.frag.glsl?raw'
import rockDetailFrag from './glsl/rockDetail.frag.glsl?raw'

export interface BakedTextures {
  /** equirectangular ground colour (rgb) + altitude (a) of the planet */
  soil: Texture
  /** equirectangular relief slope (rg), city lights (b) and clouds (a) */
  relief: Texture
  /** tiling rock detail for the surface terrain */
  rockDetail: Texture
}

const ROCK_DETAIL_SIZE = 1024
const cache = new WeakMap<WebGLRenderer, BakedTextures>()

/**
 * Computes the planet maps once on the GPU (a few fullscreen passes) instead of shipping image files.
 * Cached per renderer so React strict-mode double renders do not bake twice.
 */
export function bakePlanet(renderer: WebGLRenderer, size: number): BakedTextures {
  const cached = cache.get(renderer)
  if (cached) return cached

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  const target = (width: number, height: number, wrapS: Wrapping, wrapT: Wrapping) => {
    const rt = new WebGLRenderTarget(width, height, {
      wrapS,
      wrapT,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
      stencilBuffer: false,
    })
    rt.texture.anisotropy = anisotropy
    return rt
  }

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quad = new Mesh(new PlaneGeometry(2, 2))
  scene.add(quad)
  const previousTarget = renderer.getRenderTarget()

  const bake = (fragmentBody: string, rt: WebGLRenderTarget) => {
    const material = new ShaderMaterial({
      vertexShader: fullscreenVert,
      fragmentShader: fragmentBody,
      depthTest: false,
      depthWrite: false,
    })
    quad.material = material
    renderer.setRenderTarget(rt)
    renderer.render(scene, camera)
    material.dispose()
    return rt.texture
  }

  const planetChunk = `${valueNoise}\n${fbm}\n${planet}\n`
  const textures: BakedTextures = {
    soil: bake(planetChunk + soilFrag, target(size, size / 2, RepeatWrapping, ClampToEdgeWrapping)),
    relief: bake(planetChunk + reliefFrag, target(size, size / 2, RepeatWrapping, ClampToEdgeWrapping)),
    rockDetail: bake(
      `${valueNoise}\n${fbm}\n${rockDetailFrag}`,
      target(ROCK_DETAIL_SIZE, ROCK_DETAIL_SIZE, MirroredRepeatWrapping, MirroredRepeatWrapping),
    ),
  }

  renderer.setRenderTarget(previousTarget)
  quad.geometry.dispose()
  cache.set(renderer, textures)
  return textures
}
