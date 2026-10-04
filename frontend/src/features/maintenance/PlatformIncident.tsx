import { useId } from 'react'
import { Link } from 'react-router'
import { usePublicSettings } from '../../api/settings'
import { defineMessages, useMessages } from '../../i18n'
import { Icon } from '../../ui/Icon'
import { phoneHref } from './phoneHref'
import styles from './PlatformIncident.module.css'

const messages = defineMessages(
  {
    readOnly: 'Lecture seule',
    title: 'Incident sur la plateforme',
    still: 'La consultation reste ouverte.',
    services: 'Services et leurs horaires',
    news: 'Annonces et consignes',
    contacts: 'Coordonnées utiles',
    townHall: 'Mairie',
    email: 'E-mail',
    hours: 'Horaires',
    address: 'Adresse',
    emergency: 'Numéros d’urgence',
  },
  {
    readOnly: 'Read only',
    title: 'Platform incident',
    still: 'You can still browse.',
    services: 'Services and their opening hours',
    news: 'Announcements and instructions',
    contacts: 'Useful contacts',
    townHall: 'City hall',
    email: 'E-mail',
    hours: 'Opening hours',
    address: 'Address',
    emergency: 'Emergency numbers',
  },
)

/**
 * What stays open during a platform incident: the consigne, the pages one can still read,
 * and the numbers to call. `linkTo="city"` is for the console pages, which sit outside the flyover.
 */
export function PlatformIncident({
  showContacts = true,
  linkTo = 'here',
  nested = false,
}: {
  showContacts?: boolean
  linkTo?: 'here' | 'city'
  /** Inside a section that already has its title. */
  nested?: boolean
}) {
  const settings = usePublicSettings()
  const m = useMessages(messages)
  const titleId = useId()
  const data = settings.data
  if (!data?.maintenance_mode) return null

  const serviceHref = linkTo === 'city' ? '/ville#services' : '#services'
  const newsHref = linkTo === 'city' ? '/ville#conseil' : '#conseil'
  const contact = data.support_contact

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <p className={styles.kicker}>
        <Icon name="alert" size={16} /> {m.readOnly}
      </p>
      {nested ? <h3 id={titleId}>{m.title}</h3> : <h2 id={titleId}>{m.title}</h2>}
      <p className={styles.message} role="status">
        {data.maintenance_message}
      </p>
      <p className={styles.still}>{m.still}</p>
      <ul className={styles.links}>
        <li>
          {linkTo === 'city' ? <Link to={serviceHref}>{m.services}</Link> : <a href={serviceHref}>{m.services}</a>}
        </li>
        <li>
          {linkTo === 'city' ? <Link to={newsHref}>{m.news}</Link> : <a href={newsHref}>{m.news}</a>}
        </li>
      </ul>
      {showContacts && (
        <>
          <p className={styles.subhead}>{m.contacts}</p>
          <dl>
            <div>
              <dt>{m.townHall}</dt>
              <dd>
                <a href={phoneHref(contact.phone)}>{contact.phone}</a>
              </dd>
            </div>
            <div>
              <dt>{m.email}</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
            </div>
            <div>
              <dt>{m.hours}</dt>
              <dd>{contact.hours}</dd>
            </div>
            <div>
              <dt>{m.address}</dt>
              <dd>{contact.address}</dd>
            </div>
          </dl>
        </>
      )}
      {data.emergency_numbers.length > 0 && (
        <>
          <p className={styles.subhead}>{m.emergency}</p>
          <ul className={styles.numbers}>
            {data.emergency_numbers.map((item) => (
              <li key={item.number + item.label}>
                <a href={phoneHref(item.number)}>{item.number}</a>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
