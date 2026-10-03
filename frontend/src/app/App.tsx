import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AirlockPage } from '../pages/AirlockPage/AirlockPage'
import { CityPage } from '../pages/CityPage/CityPage'
import { FilmLayout } from './FilmLayout'

const TeamPage = lazy(() => import('../pages/TeamPage/TeamPage'))
/** Nova's test bench, compiled out of production builds. */
const NovaBench = import.meta.env.DEV ? lazy(() => import('../dev/NovaBench')) : null

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<FilmLayout />}>
          <Route index element={<AirlockPage />} />
          <Route path="ville" element={<CityPage />} />
        </Route>
        <Route
          path="equipe"
          element={
            <Suspense fallback={null}>
              <TeamPage />
            </Suspense>
          }
        />
        {NovaBench && (
          <Route
            path="dev/nova"
            element={
              <Suspense fallback={null}>
                <NovaBench />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
