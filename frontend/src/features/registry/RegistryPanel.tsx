import { useState } from 'react'
import { Plate } from '../../ui/Badges'
import { ButtonLink, ButtonRouteLink } from '../../ui/Button'
import { CountUp } from '../../ui/CountUp'
import { Row, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { REGISTRY, REGISTRY_COUNTS } from './registry'
import styles from './RegistryPanel.module.css'

/** Every request received, linked to the feature that delivers it: the jury checks in one click. */
export function RegistryPanel({ visible }: { visible: boolean }) {
  const [started, setStarted] = useState(false)
  if (visible && !started) setStarted(true)

  return (
    <>
      <div className={styles.counters}>
        <span>
          <b>
            <CountUp value={REGISTRY_COUNTS.received} start={started} duration={1200} />
          </b>
          reçues
        </span>
        <span>
          <b>
            <CountUp value={REGISTRY_COUNTS.delivered} start={started} duration={1400} />
          </b>
          livrées
        </span>
        <span>
          <b>
            <CountUp value={REGISTRY_COUNTS.inProgress} start={started} duration={900} />
          </b>
          en chantier
        </span>
      </div>
      <RowList>
        {REGISTRY.map((entry) => (
          <Row key={entry.ref}>
            <span>
              <small>
                <Plate>{entry.ref}</Plate>
              </small>
              <strong>« {entry.request} »</strong>
              <small>{entry.meta}</small>
            </span>
            {entry.section.startsWith('/') ? (
              <ButtonRouteLink variant="ghost" small to={entry.section}>
                Voir
              </ButtonRouteLink>
            ) : (
              <ButtonLink variant="ghost" small href={`#${entry.section}`}>
                Voir
              </ButtonLink>
            )}
          </Row>
        ))}
      </RowList>
      <p className={text.note}>Lignes d'exemple. La première reprend l'exemple de la documentation de l'API.</p>
    </>
  )
}
