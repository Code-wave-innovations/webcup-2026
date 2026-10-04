import { Link } from 'react-router'
import { messageFor } from '../../api/errors'
import { TRANSIT_STATUS_LABEL, useTransitDisruptions } from '../../api/transit'
import { Pill } from '../../ui/Badges'
import { ButtonRouteLink } from '../../ui/Button'
import { Row, RowList } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { LineBadge } from './LineBadge'
import { STATUS_TONE } from './transitText'
import styles from './Transit.module.css'

/** F36 on the city's home: disrupted lines at a glance and the way to the transport screen. */
export function TransitGlance() {
  const disruptions = useTransitDisruptions()

  return (
    <div className={styles.glance}>
      <div className={styles.disruptionHead}>
        <h3>Transports</h3>
        {disruptions.data?.length === 0 && <Pill tone="ok">Trafic normal sur toutes les lignes</Pill>}
      </div>
      {disruptions.isError && <p className={text.error}>{messageFor(disruptions.error)}</p>}
      {!!disruptions.data?.length && (
        <RowList>
          {disruptions.data.map((line) => (
            <Row key={line.id}>
              <Link to={`/ville/transports?ligne=${encodeURIComponent(line.code)}`}>
                <LineBadge line={line} />
                {line.status_message && <small className={styles.glanceMessage}>{line.status_message}</small>}
              </Link>
              <Pill tone={STATUS_TONE[line.status]}>{TRANSIT_STATUS_LABEL[line.status]}</Pill>
            </Row>
          ))}
        </RowList>
      )}
      <div>
        <ButtonRouteLink to="/ville/transports" variant="ghost" small>
          Horaires et prochains départs
        </ButtonRouteLink>
      </div>
    </div>
  )
}
