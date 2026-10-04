import { lazy, useEffect } from 'react'
import { MotionConfig } from 'motion/react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireStaff } from './layout/RequireStaff'
import { Shell } from './layout/Shell'
import StaffLoginPage from './layout/StaffLoginPage'
import { usePersona } from './layout/persona'
import { noteSessionExpired } from './layout/sessionNotice'
import { Toaster } from './ui/Toaster'
import { onSessionExpired } from '../api/session'
import './backoffice.css'

// F95: one chunk per screen, so a visit downloads only the pages it opens (Shell suspends on the outlet)
const AgentDashboardPage = lazy(() => import('./agent/pages/AgentDashboardPage'))
const RequestsPage = lazy(() => import('./agent/pages/RequestsPage'))
const RequestDetailPage = lazy(() => import('./agent/pages/RequestDetailPage'))
const ReportsPage = lazy(() => import('./agent/pages/ReportsPage'))
const AppointmentsPage = lazy(() => import('./agent/pages/AppointmentsPage'))
const CitizensPage = lazy(() => import('./agent/pages/CitizensPage'))
const ActivityPage = lazy(() => import('./agent/pages/ActivityPage'))
const SecurityEventsPage = lazy(() => import('./agent/pages/SecurityEventsPage'))
const NovaTerraPage = lazy(() => import('./agent/pages/NovaTerraPage'))
const AdminOverviewPage = lazy(() => import('./admin/pages/AdminOverviewPage'))
const UsersPage = lazy(() => import('./admin/pages/UsersPage'))
const RolesPage = lazy(() => import('./admin/pages/RolesPage'))
const ServicesPage = lazy(() => import('./admin/pages/ServicesPage'))
const MaintenancePage = lazy(() => import('./admin/pages/MaintenancePage'))
const AnnouncementsPage = lazy(() => import('./admin/pages/AnnouncementsPage'))
const AlertsPage = lazy(() => import('./admin/pages/AlertsPage'))
const NotificationsPage = lazy(() => import('./admin/pages/NotificationsPage'))
const TranslationsPage = lazy(() => import('./admin/pages/TranslationsPage'))
const SlotsPage = lazy(() => import('./admin/pages/SlotsPage'))
const AuditPage = lazy(() => import('./admin/pages/AuditPage'))
const RequestsSupervisionPage = lazy(() => import('./admin/pages/RequestsSupervisionPage'))
const SettingsPage = lazy(() => import('./admin/pages/SettingsPage'))
const SecurityPage = lazy(() => import('./admin/pages/SecurityPage'))
const TransportsPage = lazy(() => import('./admin/pages/TransportsPage'))
const AccountPage = lazy(() => import('./shared/AccountPage'))

/*
  Staff back-office. Screens are bound to the API plan by plan (back-office-only-plan/); the others still
  read the simulated stores and say so in their header. Mounted by src/app/App.tsx on /agent/* and
  /admin/*, outside the citizen film layout, and loaded lazily so citizens never download it.
  Routes are relative to the matched space; everything but the login page sits behind RequireStaff.
*/
export default function BackofficeApp() {
  const persona = usePersona()
  // the API refused the token: RequireStaff sends to the login page, which says why
  useEffect(() => onSessionExpired(noteSessionExpired), [])
  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="connexion" element={<StaffLoginPage />} />
        <Route
          element={
            <RequireStaff>
              <Shell />
            </RequireStaff>
          }
        >
          {persona === 'AGENT' ? (
            <>
              <Route index element={<AgentDashboardPage />} />
              <Route path="demandes" element={<RequestsPage />} />
              <Route path="demandes/:id" element={<RequestDetailPage />} />
              <Route path="signalements" element={<ReportsPage />} />
              <Route path="rendez-vous" element={<AppointmentsPage />} />
              <Route path="citoyens" element={<CitizensPage />} />
              <Route path="activite" element={<ActivityPage />} />
              <Route path="securite" element={<SecurityEventsPage />} />
              <Route path="nova-terra" element={<NovaTerraPage />} />
              <Route path="interruptions" element={<MaintenancePage />} />
              <Route path="transports" element={<TransportsPage />} />
              <Route path="compte" element={<AccountPage />} />
            </>
          ) : (
            <>
              <Route index element={<AdminOverviewPage />} />
              <Route path="demandes" element={<RequestsSupervisionPage />} />
              <Route path="demandes/:id" element={<RequestDetailPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="utilisateurs" element={<UsersPage />} />
              <Route path="roles" element={<RolesPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="maintenance" element={<MaintenancePage />} />
              <Route path="transports" element={<TransportsPage />} />
              <Route path="annonces" element={<AnnouncementsPage />} />
              <Route path="alertes" element={<AlertsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="traductions" element={<TranslationsPage />} />
              <Route path="rendez-vous" element={<SlotsPage />} />
              <Route path="parametres" element={<SettingsPage />} />
              <Route path="securite" element={<SecurityPage />} />
              <Route path="compte" element={<AccountPage />} />
            </>
          )}
          <Route path="*" element={<Navigate to={persona === 'ADMIN' ? '/admin' : '/agent'} replace />} />
        </Route>
      </Routes>
      <Toaster />
    </MotionConfig>
  )
}
