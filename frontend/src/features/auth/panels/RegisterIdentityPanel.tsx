import type { District } from '../../../api/types'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import styles from '../AccessHologram.module.css'

interface RegisterIdentityPanelProps {
  name: string
  lastName: string
  districtId: number | null
  districts: District[]
  districtsLoading: boolean
  districtsFailed: boolean
  error: string | null
  reminder: string
  onNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onDistrictChange: (id: number) => void
  onBack: () => void
}

export function RegisterIdentityPanel({
  name,
  lastName,
  districtId,
  districts,
  districtsLoading,
  districtsFailed,
  error,
  reminder,
  onNameChange,
  onLastNameChange,
  onDistrictChange,
  onBack,
}: RegisterIdentityPanelProps) {
  const districtMsg = 'Impossible de charger les quartiers.'
  const districtFieldError = districtsFailed || error === districtMsg ? districtMsg : undefined
  const nameFieldError = error && error !== districtMsg ? error : undefined

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div className={styles.dots} aria-label="Étape 1 sur 3">
        <i data-active="true" />
        <i data-active="false" />
        <i data-active="false" />
      </div>
      <p className={styles.reminder}>{reminder}</p>
      <Field label="Prénom" htmlFor="access-name" error={nameFieldError}>
        <input
          id="access-name"
          name="name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Field>
      <Field label="Nom" htmlFor="access-last-name">
        <input
          id="access-last-name"
          name="last_name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
        />
      </Field>
      <Field label="Quartier" htmlFor="access-district" error={districtFieldError}>
        <select
          id="access-district"
          name="district_id"
          disabled={districtsLoading || districts.length === 0}
          value={districtId ?? ''}
          onChange={(e) => onDistrictChange(Number(e.target.value))}
        >
          {districtsLoading && <option value="">Chargement…</option>}
          {!districtsLoading && districts.length === 0 && <option value="">Aucun quartier</option>}
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} data-nova-look>
          Suivant
        </Button>
        <Button type="button" variant="ghost" className={styles.back} onClick={onBack}>
          Retour
        </Button>
      </div>
    </div>
  )
}
