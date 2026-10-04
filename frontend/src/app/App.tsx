import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AirlockPage } from '../pages/AirlockPage/AirlockPage'
import { CityPage } from '../pages/CityPage/CityPage'
import { ConsoleLayout } from '../pages/Console/ConsoleLayout'
import { NotFoundPage } from '../pages/Console/NotFoundPage'
import { FilmLayout } from './FilmLayout'
import { RequireRole, RequireSession } from './guards'

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
/** D04: write to municipal services (console over the dimmed city). */
const ContactPage = lazy(() => import('../pages/Console/ContactPage'))
const BookAppointmentPage = lazy(() => import('../pages/Console/BookAppointmentPage'))
const MyAppointmentsPage = lazy(() => import('../pages/Console/MyAppointmentsPage'))
const EspaceHubPage = lazy(() => import('../pages/Espace/EspaceHubPage'))
const DemandesListPage = lazy(() => import('../pages/Espace/DemandesListPage'))
const DemandeDetailPage = lazy(() => import('../pages/Espace/DemandeDetailPage'))
const ComptePage = lazy(() => import('../pages/Espace/ComptePage'))

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
              <Route
                path="contact"
                element={
                  <Suspense fallback={null}>
                    <ContactPage />
                  </Suspense>
                }
              />
              {/* F39 / F40: appointments with an agent, for a signed-in resident */}
              <Route
                path="rendez-vous"
                element={
                  <RequireRole roles={['CITIZEN']}>
                    <Suspense fallback={null}>
                      <MyAppointmentsPage />
                    </Suspense>
                  </RequireRole>
                }
              />
              <Route
                path="rendez-vous/nouveau"
                element={
                  <RequireRole roles={['CITIZEN']}>
                    <Suspense fallback={null}>
                      <BookAppointmentPage />
                    </Suspense>
                  </RequireRole>
                }
              />
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
              <Route
                path="espace"
                element={
                  <RequireSession>
                    <Suspense fallback={null}>
                      <EspaceHubPage />
                    </Suspense>
                  </RequireSession>
                }
              />
              <Route
                path="espace/demandes"
                element={
                  <RequireSession>
                    <Suspense fallback={null}>
                      <DemandesListPage />
                    </Suspense>
                  </RequireSession>
                }
              />
              <Route
                path="espace/demandes/:id"
                element={
                  <RequireSession>
                    <Suspense fallback={null}>
                      <DemandeDetailPage />
                    </Suspense>
                  </RequireSession>
                }
              />
              <Route
                path="espace/compte"
                element={
                  <RequireSession>
                    <Suspense fallback={null}>
                      <ComptePage />
                    </Suspense>
                  </RequireSession>
                }
              />
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
