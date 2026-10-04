import type { CityService } from '../../../api/types'
import { BarChart } from '../../charts/BarChart'
import { Panel } from '../../ui/Panel'
import styles from './admin.module.css'
import { serviceUsage } from './serviceUsage'

/** F28: a reading of resident visits, not the raw counter repeated on each card. */
export function ServiceUsage({ services }: { services: CityService[] }) {
  const usage = serviceUsage(services)
  return (
    <Panel kicker="Habitants" title="Services les plus consultés" accent="ice">
      <p className={styles.usageReading}>{usage.reading}</p>
      {usage.action && <p className={styles.usageAction}>{usage.action}</p>}
      {usage.ranked.length > 0 && (
        <BarChart
          bars={usage.ranked.map((service) => ({ label: service.name, value: service.views }))}
          summary={usage.reading}
          valueHeader="Consultations"
        />
      )}
    </Panel>
  )
}
