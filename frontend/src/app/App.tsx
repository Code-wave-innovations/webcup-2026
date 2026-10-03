import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AirlockPage } from '../pages/AirlockPage/AirlockPage'
import { CityPage } from '../pages/CityPage/CityPage'
import { ConsoleLayout } from '../pages/Console/ConsoleLayout'
import { NotFoundPage } from '../pages/Console/NotFoundPage'
import { FilmLayout } from './FilmLayout'

const ChatPage = lazy(() => import('../pages/ChatPage/ChatPage'))
const TeamPage = lazy(() => import('../pages/TeamPage/TeamPage'))
const FaceUnlock = lazy(() => import('../components/Face/FaceUnlock'))
const RealtimeTranscription = lazy(() => import('../components/Realtime/RealtimeTranscription'))
/** Staff back-office (agents and admins), kept out of the citizen bundle. */
const BackofficeApp = lazy(() => import('../backoffice/BackofficeApp'))
/** Nova's test bench, compiled out of production builds. */
const NovaBench = import.meta.env.DEV ? lazy(() => import('../dev/NovaBench')) : null
/** Check of the console chain (layout, API, session, forms), development only. */
const ConsoleTestPage = import.meta.env.DEV ? lazy(() => import('../dev/ConsoleTestPage')) : null

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<FilmLayout />}>
          <Route index element={<AirlockPage />} />
          <Route path="ville">
            <Route index element={<CityPage />} />
            {/* pages beyond the flyover, over the dimmed city */}
            <Route element={<ConsoleLayout />}>
              {ConsoleTestPage && (
                <Route
                  path="test"
                  element={
                    <Suspense fallback={null}>
                      <ConsoleTestPage />
                    </Suspense>
                  }
                />
              )}
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
          <Route
            path="nova"
            element={
              <Suspense fallback={null}>
                <ChatPage />
              </Suspense>
            }
          />
        </Route>
        <Route
          path="equipe"
          element={
            <Suspense fallback={null}>
              <TeamPage />
            </Suspense>
          }
        />
        <Route
          path="face"
          element={
            <Suspense fallback={null}>
              <FaceUnlock />
            </Suspense>
          }
        />
        <Route
          path="transcription"
          element={
            <Suspense fallback={null}>
              <RealtimeTranscription />
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
