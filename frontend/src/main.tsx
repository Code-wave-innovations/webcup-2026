import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/unbounded'
import '@fontsource/chakra-petch/latin-400.css'
import '@fontsource/chakra-petch/latin-500.css'
import '@fontsource/chakra-petch/latin-600.css'
import './index.css'
import App from './app/App.tsx'
import { queryClient } from './api/queryClient'
import { SCENE } from './a11y/sceneMode'

// F96: the light version restyles the whole page (system fonts, opaque panels) from the first paint
document.documentElement.dataset.scene = SCENE.mode

/** Server-state inspector, compiled out of production builds. */
const QueryDevtools = import.meta.env.DEV
  ? lazy(() => import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {QueryDevtools && (
        <Suspense fallback={null}>
          <QueryDevtools buttonPosition="bottom-left" />
        </Suspense>
      )}
    </QueryClientProvider>
  </StrictMode>,
)
