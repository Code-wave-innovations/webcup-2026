import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { isLightScene } from '../a11y/sceneMode'
import { ConsoleLayout } from '../pages/Console/ConsoleLayout'
import { NotFoundPage } from '../pages/Console/NotFoundPage'
import { FilmLoadingScreen } from './FilmLoadingScreen'
import { LightLayout } from './LightLayout'
import { RequireRole, RequireSession } from './guards'

/*
 * F96: the film (three.js, Nova's model, the director) is only reached through these imports, so the light
 * version never downloads it. Arriving on a film route of the complete version, they all start downloading
 * together at once, as when they were static imports, instead of one after the other. Elsewhere (back-office,
 * team page) the film loads on the first visit to one of its routes, like any lazy page.
 */
const loadFilmLayout = () => import('./FilmLayout')
const loadAirlockPage = () => import('../pages/AirlockPage/AirlockPage')
const loadCityPage = () => import('../pages/CityPage/CityPage')
/** the film routes: the airlock (/), the city (/ville/*) and the chat (/nova) */
const onFilmRoute = typeof window !== 'undefined' && /^\/(?:ville(?:\/|$)|nova(?:\/|$)|$)/.test(window.location.pathname)
if (!isLightScene && onFilmRoute) {
  void loadFilmLayout()
  void loadAirlockPage()
  void loadCityPage()
}
const FilmLayout = lazy(() => loadFilmLayout().then((m) => ({ default: m.FilmLayout })))
const AirlockPage = lazy(() => loadAirlockPage().then((m) => ({ default: m.AirlockPage })))
const CityPage = lazy(() => loadCityPage().then((m) => ({ default: m.CityPage })))
/** F96: the light version's own pages (airlock, home, chat); the console pages are shared */
const LightAirlockPage = lazy(() => import('../pages/LightAirlock/LightAirlockPage'))
const LightHomePage = lazy(() => import('../pages/LightHome/LightHomePage'))
const LightChatPage = lazy(() => import('../pages/LightChat/LightChatPage'))

const AnnouncementsPage = lazy(() => import('../pages/Announcements/AnnouncementsPage'))
const AnnouncementPage = lazy(() => import('../pages/Announcements/AnnouncementPage'))
const TransportsPage = lazy(() => import('../pages/Transports/TransportsPage'))
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
        {/* F96: same URLs in both versions; the light one never mounts the film */}
        <Route
          element={
            isLightScene ? (
              <LightLayout />
            ) : (
              <Suspense fallback={<FilmLoadingScreen />}>
                <FilmLayout />
              </Suspense>
            )
          }
        >
          <Route
            index
            element={<Suspense fallback={null}>{isLightScene ? <LightAirlockPage /> : <AirlockPage />}</Suspense>}
          />
          <Route path="ville">
            {!isLightScene && (
              <Route
                index
                element={
                  <Suspense fallback={null}>
                    <CityPage />
                  </Suspense>
                }
              />
            )}
            {/* pages beyond the flyover, over the dimmed city */}
            <Route element={<ConsoleLayout />}>
              {isLightScene && (
                <Route
                  index
                  element={
                    <Suspense fallback={null}>
                      <LightHomePage />
                    </Suspense>
                  }
                />
              )}
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
                path="annonces"
                element={
                  <Suspense fallback={null}>
                    <AnnouncementsPage />
                  </Suspense>
                }
              />
              <Route
                path="annonces/:id"
                element={
                  <Suspense fallback={null}>
                    <AnnouncementPage />
                  </Suspense>
                }
              />
              <Route
                path="transports"
                element={
                  <Suspense fallback={null}>
                    <TransportsPage />
                  </Suspense>
                }
              />
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
          {isLightScene ? (
            <Route element={<ConsoleLayout />}>
              <Route
                path="nova"
                element={
                  <Suspense fallback={null}>
                    <LightChatPage />
                  </Suspense>
                }
              />
            </Route>
          ) : (
            <Route
              path="nova"
              element={
                <Suspense fallback={null}>
                  <ChatPage />
                </Suspense>
              }
            />
          )}
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
