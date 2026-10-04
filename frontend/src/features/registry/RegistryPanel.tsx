import { useState } from 'react'
import { useMessages } from '../../i18n'
import { Plate } from '../../ui/Badges'
import { ButtonLink, ButtonRouteLink } from '../../ui/Button'
import { CountUp } from '../../ui/CountUp'
import { Row, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { REGISTRY, REGISTRY_COUNTS, registryMessages } from './registry'
import styles from './RegistryPanel.module.css'

/** Every request received, linked to the feature that delivers it: the jury checks in one click. */
export function RegistryPanel({ visible }: { visible: boolean }) {
  const [started, setStarted] = useState(false)
  const m = useMessages(registryMessages)
  if (visible && !started) setStarted(true)

  return (
    <>
      <div className={styles.counters}>
        <span>
          <b>
            <CountUp value={REGISTRY_COUNTS.received} start={started} duration={1200} />
          </b>
          {m.received}
        </span>
        <span>
          <b>
            <CountUp value={REGISTRY_COUNTS.delivered} start={started} duration={1400} />
          </b>
          {m.delivered}
        </span>
        <span>
          <b>
            <CountUp value={REGISTRY_COUNTS.inProgress} start={started} duration={900} />
          </b>
          {m.inProgress}
        </span>
      </div>
      <RowList>
        {REGISTRY.map((entry) => (
          <Row key={entry.ref}>
            <span>
              <small>
                <Plate>{entry.ref}</Plate>
              </small>
              <strong>{m.quote(m.entries[entry.ref].request)}</strong>
              <small>{m.entries[entry.ref].meta}</small>
            </span>
            {entry.section.startsWith('/') ? (
              <ButtonRouteLink variant="ghost" small to={entry.section}>
                {m.see}
              </ButtonRouteLink>
            ) : (
              <ButtonLink variant="ghost" small href={`#${entry.section}`}>
                {m.see}
              </ButtonLink>
            )}
          </Row>
        ))}
      </RowList>
      <p className={text.note}>{m.note}</p>
    </>
  )
}
