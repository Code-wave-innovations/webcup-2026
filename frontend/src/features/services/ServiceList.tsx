import { Pill } from '../../ui/Badges'
import { RowButton, RowButtons } from '../../ui/Rows'
import text from '../../ui/text.module.css'
import { announce } from '../../ui/toastStore'
import { SERVICES } from './services'

/** Every service of the city has its counter, open day and night. */
export function ServiceList() {
  return (
    <>
      <RowButtons>
        {SERVICES.map((service) => (
          <RowButton key={service.name} onClick={() => announce(`Guichet ouvert : ${service.name}`)}>
            <span>
              <strong>{service.name}</strong>
              <small>{service.detail}</small>
            </span>
            <Pill tone={service.tone}>{service.state}</Pill>
          </RowButton>
        ))}
      </RowButtons>
      <p className={text.note}>Exemples de services. La liste réelle vient des demandes de l'API.</p>
    </>
  )
}
