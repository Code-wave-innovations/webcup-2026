import { messageFor } from '../api/errors'
import { usePublicSettings } from '../api/settings'
import { ConsolePage } from '../pages/Console/ConsolePage'
import { GlassPanel } from '../ui/GlassPanel'
import text from '../ui/text.module.css'
import { DevLogin } from './DevLogin'

/** Development check of the console chain: layout, API client, server cache, session, forms. */
export default function ConsoleTestPage() {
  const settings = usePublicSettings()

  return (
    <ConsolePage
      title="Diagnostic de la console"
      crumbs={[{ label: 'Développement' }]}
      lead="Page de développement (absente du build de production) : elle vérifie la chaîne complète entre la console et l’API."
    >
      <GlassPanel>
        <h2>API : paramètres publics</h2>
        {settings.isPending && <p className={text.note}>Chargement…</p>}
        {settings.isError && <p className={text.error}>{messageFor(settings.error)}</p>}
        {settings.data && (
          <ul>
            <li>Inscriptions : {settings.data.registration_open ? 'ouvertes' : 'fermées'}</li>
            <li>Maintenance : {settings.data.maintenance_mode ? 'activée' : 'désactivée'}</li>
            <li>Contact : {settings.data.support_contact.phone}, {settings.data.support_contact.hours}</li>
            <li>Rappel de rendez-vous par défaut : {settings.data.reminder_default_minutes} min</li>
          </ul>
        )}
      </GlassPanel>
      <GlassPanel>
        <h2>Session</h2>
        <DevLogin />
      </GlassPanel>
    </ConsolePage>
  )
}
