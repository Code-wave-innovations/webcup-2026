/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // SWIFTASK_API_KEY (Nova's voice) is read by the browser too, so it ends up in the public bundle
  envPrefix: ['VITE_', 'SWIFTASK_'],
  build: {
    // three.js is one deliberate vendor chunk (≈ 250 kB gzipped); the face detector (tfjs) is the other big one
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        // Vendor code changes far less often than the app code: keep it in long-cached chunks.
        // F95: a group only takes the modules its test matches. With the default (true), the 3D group also swallowed
        // React and zustand, so every page, the back-office included, preloaded the 3D engine to get React.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/, priority: 20 },
            // zustand must NOT sit in `api`: i18n/locale (messages chunk) calls create() at init, while
            // api/errors imports defineMessages — forcing zustand into api made messages→api→messages
            // and crashed prod with "t is not a function" (create still undefined).
            { name: 'zustand', test: /node_modules[\\/]zustand[\\/]/, priority: 15 },
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 10 },
            { name: 'r3f', test: /node_modules[\\/](postprocessing|@react-three|three-stdlib|three-mesh-bvh|troika-[\w-]+|camera-controls|maath)[\\/]/, priority: 10 },
            // without these two, the shared data layer and back-office primitives came as ~20 chunks of 1 kB each
            { name: 'api', test: /src[\\/]api[\\/]|node_modules[\\/](@tanstack[\\/]query-core|@tanstack[\\/]react-query|axios)[\\/]/, priority: 5 },
            { name: 'bo-ui', test: /src[\\/]backoffice[\\/](ui|charts|shared|lib)[\\/]/, priority: 5 },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // the city and bird simulations take a few seconds each, and longer when every file runs in parallel
    testTimeout: 30000,
    environment: 'node',
  },
})
