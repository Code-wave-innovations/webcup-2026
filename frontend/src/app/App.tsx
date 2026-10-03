import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AirlockPage } from '../pages/AirlockPage/AirlockPage'
import { CityPage } from '../pages/CityPage/CityPage'
import { FilmLayout } from './FilmLayout'

const TeamPage = lazy(() => import('../pages/TeamPage/TeamPage'))
/** Staff back-office (agents and admins), kept out of the citizen bundle. */
const BackofficeApp = lazy(() => import('../backoffice/BackofficeApp'))
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
        {['agent/*', 'admin/*'].map((path) => (
          <Route key={path} path={path} element={<Suspense fallback={null}><BackofficeApp /></Suspense>} />
        ))}
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
