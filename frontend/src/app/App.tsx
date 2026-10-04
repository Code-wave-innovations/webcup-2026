import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { isLightScene, SCENE_REDIRECTING } from '../a11y/sceneMode'
import { isLightPath } from '../a11y/scenePaths'
import { ConsoleLayout } from '../pages/Console/ConsoleLayout'
import { NotFoundPage } from '../pages/Console/NotFoundPage'
import { FilmLoadingScreen } from './FilmLoadingScreen'
import { LightLayout } from './LightLayout'
import { SceneRouter } from './SceneRouter'
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
/** the film routes: the airlock (/), the city (/ville/*) and the chat (/nova). `/leger` never preloads them. */
const onFilmRoute =
  typeof window !== 'undefined' && !isLightPath(window.location.pathname) && /^\/(?:ville(?:\/|$)|nova(?:\/|$)|$)/.test(window.location.pathname)
if (!SCENE_REDIRECTING && !isLightScene && onFilmRoute) {
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

function page(node: ReactNode) {
  return <Suspense fallback={null}>{node}</Suspense>
}

/** Pages past the flyover. Shared by both versions; links stay `/ville/...` and the light router prefixes them. */
function consolePages() {
  return (
    <>
      <Route path="contact" element={page(<ContactPage />)} />
      {/* F39 / F40: appointments with an agent, for a signed-in resident */}
      <Route path="rendez-vous" element={<RequireRole roles={['CITIZEN']}>{page(<MyAppointmentsPage />)}</RequireRole>} />
      <Route path="rendez-vous/nouveau" element={<RequireRole roles={['CITIZEN']}>{page(<BookAppointmentPage />)}</RequireRole>} />
      {ConsoleTestPage && <Route path="test" element={page(<ConsoleTestPage />)} />}
      <Route path="annonces" element={page(<AnnouncementsPage />)} />
      <Route path="annonces/:id" element={page(<AnnouncementPage />)} />
      <Route path="transports" element={page(<TransportsPage />)} />
      <Route path="espace" element={<RequireSession>{page(<EspaceHubPage />)}</RequireSession>} />
      <Route path="espace/demandes" element={<RequireSession>{page(<DemandesListPage />)}</RequireSession>} />
      <Route path="espace/demandes/:id" element={<RequireSession>{page(<DemandeDetailPage />)}</RequireSession>} />
      <Route path="espace/compte" element={<RequireSession>{page(<ComptePage />)}</RequireSession>} />
      <Route path="*" element={<NotFoundPage />} />
    </>
  )
}

/** One version: `leger` for the light pages, no path for the complete film. */
function citizenRoutes(mode: 'light' | 'complete') {
  const light = mode === 'light'
  return (
    <Route
      key={mode}
      path={light ? 'leger' : undefined}
      element={light ? <LightLayout /> : <Suspense fallback={<FilmLoadingScreen />}><FilmLayout /></Suspense>}
    >
      <Route index element={page(light ? <LightAirlockPage /> : <AirlockPage />)} />
      <Route path="ville">
        {!light && <Route index element={page(<CityPage />)} />}
        <Route element={<ConsoleLayout />}>
          {light && <Route index element={page(<LightHomePage />)} />}
          {consolePages()}
        </Route>
      </Route>
      {light ? (
        <Route element={<ConsoleLayout />}>
          <Route path="nova" element={page(<LightChatPage />)} />
        </Route>
      ) : (
        <Route path="nova" element={page(<ChatPage />)} />
      )}
      {light && <Route path="*" element={<Navigate to="/" replace />} />}
    </Route>
  )
}

function App() {
  if (SCENE_REDIRECTING) return null
  return (
    <SceneRouter>
      <Routes>
        {/* F96: `/leger` is the light version; `/`, `/ville` and `/nova` are the complete film */}
        {citizenRoutes('light')}
        {citizenRoutes('complete')}
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
    </SceneRouter>
  )
}

export default App
