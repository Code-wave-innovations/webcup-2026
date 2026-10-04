import { currentLocale, defineMessages, messagesFor, useLocale, type Locale } from '../../i18n'
import type { Session } from './authService'
import type { RoleKey } from './demoAccounts'

/*
  D14: the role shown next to the visitor's name (city top bar, console bar). The session keeps the
  French label it was opened with; these helpers say it in the visitor's language at display time.
*/

const messages = defineMessages(
  { resident: 'Habitante', council: 'Haut Conseil', admin: 'Administration', agent: 'Agent' },
  { resident: 'Resident', council: 'High Council', admin: 'Administration', agent: 'Agent' },
)

/** Sessions saved before the role key existed only carry the French label. */
const KEY_OF_LABEL: Record<string, RoleKey> = {
  Habitante: 'resident',
  'Habitant·e': 'resident',
  Habitant: 'resident',
  'Haut Conseil': 'council',
  Administration: 'admin',
  Agent: 'agent',
}

type RoleSession = Pick<Session, 'roleLabel' | 'roleKey'>

/** The role label of a session in the given language (French keeps the label the session was opened with). */
export function sessionRoleLabel(session: RoleSession, locale: Locale = currentLocale()): string {
  if (locale === 'fr') return session.roleLabel
  const key = session.roleKey ?? KEY_OF_LABEL[session.roleLabel]
  return key ? messagesFor(messages, locale)[key] : session.roleLabel
}

/** Same, in a component: re-renders when the visitor switches language. */
export function useSessionRoleLabel(session: RoleSession | null | undefined): string {
  const locale = useLocale()
  return session ? sessionRoleLabel(session, locale) : ''
}
