import type { District } from '../../../api/types'
import { Button } from '../../../ui/Button'
import { Field } from '../../../ui/Field'
import { defineMessages, useMessages } from '../../../i18n'
import styles from '../AccessHologram.module.css'

const messages = defineMessages(
  {
    districtsFailed: 'Impossible de charger les quartiers.',
    step: 'Étape 1 sur 3',
    firstName: 'Prénom',
    lastName: 'Nom',
    district: 'Quartier',
    loading: 'Chargement…',
    noDistrict: 'Aucun quartier',
    next: 'Suivant',
    back: 'Retour',
  },
  {
    districtsFailed: 'Unable to load the districts.',
    step: 'Step 1 of 3',
    firstName: 'First name',
    lastName: 'Last name',
    district: 'District',
    loading: 'Loading…',
    noDistrict: 'No district',
    next: 'Next',
    back: 'Back',
  },
)

interface RegisterIdentityPanelProps {
  name: string
  lastName: string
  districtId: number | null
  districts: District[]
  districtsLoading: boolean
  districtsFailed: boolean
  error: string | null
  /** the error is about the districts (shown under that field) */
  districtError?: boolean
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
  districtError = false,
  reminder,
  onNameChange,
  onLastNameChange,
  onDistrictChange,
  onBack,
}: RegisterIdentityPanelProps) {
  const m = useMessages(messages)
  const districtFieldError = districtsFailed || districtError ? m.districtsFailed : undefined
  const nameFieldError = error && !districtError ? error : undefined

  return (
    <div className={`${styles.panel} ${styles.panelEnter}`}>
      <div className={styles.dots} aria-label={m.step}>
        <i data-active="true" />
        <i data-active="false" />
        <i data-active="false" />
      </div>
      <p className={styles.reminder}>{reminder}</p>
      <Field label={m.firstName} htmlFor="access-name" error={nameFieldError}>
        <input
          id="access-name"
          name="name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </Field>
      <Field label={m.lastName} htmlFor="access-last-name">
        <input
          id="access-last-name"
          name="last_name"
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => onLastNameChange(e.target.value)}
        />
      </Field>
      <Field label={m.district} htmlFor="access-district" error={districtFieldError}>
        <select
          id="access-district"
          name="district_id"
          disabled={districtsLoading || districts.length === 0}
          value={districtId ?? ''}
          onChange={(e) => onDistrictChange(Number(e.target.value))}
        >
          {districtsLoading && <option value="">{m.loading}</option>}
          {!districtsLoading && districts.length === 0 && <option value="">{m.noDistrict}</option>}
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </Field>
      <div className={styles.actions}>
        <Button type="submit" className={styles.submit} data-nova-look>
          {m.next}
        </Button>
        <Button type="button" variant="ghost" className={styles.back} onClick={onBack}>
          {m.back}
        </Button>
      </div>
    </div>
  )
}
