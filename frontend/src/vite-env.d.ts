/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL?: string
  readonly VITE_API_URL?: string
  readonly VITE_IMG_URL?: string
  readonly VITE_FACE_API_URL?: string
  readonly VITE_FACE_API_KEY?: string
  readonly VITE_STT_API_URL?: string
  /** Swiftask API key for Nova's voice (text-to-speech); it ends up in the public bundle */
  readonly SWIFTASK_API_KEY?: string
  /** Cloudflare Turnstile site key (public); pair with backend TURNSTILE_SECRET_KEY */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** Nova's GLB (default /models/nova.glb); empty for the procedural stand-in */
  readonly VITE_NOVA_MODEL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
