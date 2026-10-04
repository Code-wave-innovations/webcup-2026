import { useEffect, useRef } from 'react'
import { useActiveAlerts } from '../../api/alerts'
import { useLatestAnnouncements } from '../../api/announcements'
import { useDistricts } from '../../api/districts'
import { alertViewerKey, formatSavedAt, isNetworkFailure, readEssential, rememberEssential } from '../../api/essentialCache'
import { queryClient } from '../../api/queryClient'
import { useCitizenSessionStore, useCitizenUser } from '../../api/session'
import { usePublicServices, useServiceCategories } from '../../api/services'
import { usePublicSettings } from '../../api/settings'
import { Icon } from '../../ui/Icon'
import { useAuthStore } from '../auth/authStore'
import { phoneHref } from '../maintenance/phoneHref'
import { useOnline } from './networkStatus'
import styles from './NetworkIncident.module.css'

/** Public reads the citizen space can show again after a dropped connection. */
function retryEssentials() {
  void queryClient.invalidateQueries({ queryKey: ['settings'] })
  void queryClient.invalidateQueries({ queryKey: ['announcements'] })
  void queryClient.invalidateQueries({ queryKey: ['services'] })
  void queryClient.invalidateQueries({ queryKey: ['service-categories'] })
  void queryClient.invalidateQueries({ queryKey: ['districts'] })
  void queryClient.invalidateQueries({ queryKey: ['alerts'] })
}

/**
 * A dropped link must not blank the city. What was already received stays on screen;
 * this bar says what is waiting and how to ask again, and keeps the numbers to call.
 */
export function NetworkIncident() {
  const online = useOnline()
  const citizenToken = useCitizenSessionStore((s) => s.token)
  const filmToken = useAuthStore((s) => s.session?.token)
  const token = citizenToken ?? filmToken
  const viewerId = useCitizenUser()?.id ?? null
  const viewerKey = alertViewerKey(token, viewerId)
  const settings = usePublicSettings()
  const announcements = useLatestAnnouncements(3)
  const serviceList = usePublicServices()
  const categories = useServiceCategories()
  const districts = useDistricts()
  const alerts = useActiveAlerts(token)
  const wasOnline = useRef(online)

  useEffect(() => {
    rememberEssential({
      settings: settings.data,
      announcements: announcements.data,
      serviceList: serviceList.data,
      categories: categories.data,
      districts: districts.data,
      alerts: alerts.data ? { viewerKey, items: alerts.data } : undefined,
    })
  }, [settings.data, announcements.data, serviceList.data, categories.data, districts.data, alerts.data, viewerKey])

  useEffect(() => {
    if (online && !wasOnline.current) retryEssentials()
    wasOnline.current = online
  }, [online])

  const queries = [settings, announcements, serviceList, categories, districts, alerts]
  const broken = queries.some((query) => query.isError && isNetworkFailure(query.error))
  const pending = queries.some((query) => query.isFetching)
  if (online && !broken) return null

  const savedAt = readEssential()?.savedAt
  const when = savedAt ? formatSavedAt(savedAt) : ''
  const contact = settings.data?.support_contact
  const numbers = settings.data?.emergency_numbers ?? []

  return (
    <section className={styles.bar} role="status" aria-label="Connexion interrompue">
      <p className={styles.kicker}>
        <Icon name="alert" size={16} />
        {online ? 'Serveur injoignable' : 'Réseau interrompu'}
      </p>
      <p className={styles.message}>
        {online
          ? 'Le serveur de la ville ne répond pas. L’envoi d’un signalement et le message à la mairie sont en attente.'
          : 'Cet appareil n’a plus accès au réseau. L’envoi d’un signalement et le message à la mairie sont en attente.'}
      </p>
      <p className={styles.still}>
        {when
          ? `Les annonces, les consignes, l’état des services et les coordonnées déjà reçus restent consultables. Dernière réception : ${when}.`
          : 'Rien n’est encore enregistré sur cet appareil. Réessayez dès que la liaison revient : les annonces, les services et les numéros s’afficheront ici.'}
      </p>
      {(contact || numbers.length > 0) && (
        <ul className={styles.numbers}>
          {contact && (
            <li>
              <a href={phoneHref(contact.phone)}>{contact.phone}</a>
              <span>Mairie</span>
            </li>
          )}
          {numbers.map((item) => (
            <li key={item.number + item.label}>
              <a href={phoneHref(item.number)}>{item.number}</a>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={retryEssentials} disabled={pending}>
        {pending ? 'Nouvelle tentative…' : 'Réessayer'}
      </button>
    </section>
  )
}
