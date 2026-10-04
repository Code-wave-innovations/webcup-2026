import { useEffect } from 'react'
import { MotionConfig } from 'motion/react'
import { Navigate, Route, Routes } from 'react-router'
import { RequireStaff } from './layout/RequireStaff'
import { Shell } from './layout/Shell'
import StaffLoginPage from './layout/StaffLoginPage'
import { usePersona } from './layout/persona'
import { noteSessionExpired } from './layout/sessionNotice'
import { Toaster } from './ui/Toaster'
import { onSessionExpired } from '../api/session'
import AgentDashboardPage from './agent/pages/AgentDashboardPage'
import RequestsPage from './agent/pages/RequestsPage'
import RequestDetailPage from './agent/pages/RequestDetailPage'
import ReportsPage from './agent/pages/ReportsPage'
import AppointmentsPage from './agent/pages/AppointmentsPage'
import CitizensPage from './agent/pages/CitizensPage'
import ActivityPage from './agent/pages/ActivityPage'
import NovaTerraPage from './agent/pages/NovaTerraPage'
import AdminOverviewPage from './admin/pages/AdminOverviewPage'
import UsersPage from './admin/pages/UsersPage'
import RolesPage from './admin/pages/RolesPage'
import ServicesPage from './admin/pages/ServicesPage'
import MaintenancePage from './admin/pages/MaintenancePage'
import AnnouncementsPage from './admin/pages/AnnouncementsPage'
import AlertsPage from './admin/pages/AlertsPage'
import NotificationsPage from './admin/pages/NotificationsPage'
import TranslationsPage from './admin/pages/TranslationsPage'
import SlotsPage from './admin/pages/SlotsPage'
import AuditPage from './admin/pages/AuditPage'
import RequestsSupervisionPage from './admin/pages/RequestsSupervisionPage'
import SettingsPage from './admin/pages/SettingsPage'
import SecurityPage from './admin/pages/SecurityPage'
import AccountPage from './shared/AccountPage'
import './backoffice.css'

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
              <Route path="nova-terra" element={<NovaTerraPage />} />
              <Route path="interruptions" element={<MaintenancePage />} />
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
