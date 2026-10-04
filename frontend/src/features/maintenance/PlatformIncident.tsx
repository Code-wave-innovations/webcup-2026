import { useId } from 'react'
import { Link } from 'react-router'
import { usePublicSettings } from '../../api/settings'
import { Icon } from '../../ui/Icon'
import { phoneHref } from './phoneHref'
import styles from './PlatformIncident.module.css'

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
  const titleId = useId()
  const data = settings.data
  if (!data?.maintenance_mode) return null

  const serviceHref = linkTo === 'city' ? '/ville#services' : '#services'
  const newsHref = linkTo === 'city' ? '/ville#conseil' : '#conseil'
  const contact = data.support_contact

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <p className={styles.kicker}>
        <Icon name="alert" size={16} /> Lecture seule
      </p>
      {nested ? <h3 id={titleId}>Incident sur la plateforme</h3> : <h2 id={titleId}>Incident sur la plateforme</h2>}
      <p className={styles.message} role="status">
        {data.maintenance_message}
      </p>
      <p className={styles.still}>La consultation reste ouverte.</p>
      <ul className={styles.links}>
        <li>
          {linkTo === 'city' ? <Link to={serviceHref}>Services et leurs horaires</Link> : <a href={serviceHref}>Services et leurs horaires</a>}
        </li>
        <li>
          {linkTo === 'city' ? <Link to={newsHref}>Annonces et consignes</Link> : <a href={newsHref}>Annonces et consignes</a>}
        </li>
      </ul>
      {showContacts && (
        <>
          <p className={styles.subhead}>Coordonnées utiles</p>
          <dl>
            <div>
              <dt>Mairie</dt>
              <dd>
                <a href={phoneHref(contact.phone)}>{contact.phone}</a>
              </dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </dd>
            </div>
            <div>
              <dt>Horaires</dt>
              <dd>{contact.hours}</dd>
            </div>
            <div>
              <dt>Adresse</dt>
              <dd>{contact.address}</dd>
            </div>
          </dl>
        </>
      )}
      {data.emergency_numbers.length > 0 && (
        <>
          <p className={styles.subhead}>Numéros d’urgence</p>
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
