import { CHAT_SUGGESTIONS } from '../../features/chat/chatScript'
import { ButtonRouteLink } from '../../ui/Button'
import styles from './NovaInvite.module.css'

/** The Observatory's panel: Nova's invitation, questions to ask straight away, and the way up to the chat. */
export function NovaInvite() {
  return (
    <div className={styles.invite}>
      <p className={styles.bubble}>
        <b>Nova</b>
        Montez à l'Observatoire, on discute en regardant la ville s'allumer.
      </p>
      <ul className={styles.questions} aria-label="Questions à poser à Nova">
        {CHAT_SUGGESTIONS.map((question) => (
          <li key={question}>
            <ButtonRouteLink variant="ghost" small to={`/nova?q=${encodeURIComponent(question)}`}>
              {question}
            </ButtonRouteLink>
          </li>
        ))}
      </ul>
      <ButtonRouteLink to="/nova" data-nova-look>
        Parler à Nova
      </ButtonRouteLink>
    </div>
  )
}
