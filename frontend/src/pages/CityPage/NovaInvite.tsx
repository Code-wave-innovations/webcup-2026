import { useChatSuggestions } from '../../features/chat/chatScript'
import { defineMessages, useMessages } from '../../i18n'
import { ButtonRouteLink } from '../../ui/Button'
import styles from './NovaInvite.module.css'

const messages = defineMessages(
  {
    invite: "Montez à l'Observatoire, on discute en regardant la ville s'allumer.",
    questions: 'Questions à poser à Nova',
    talk: 'Parler à Nova',
  },
  {
    invite: 'Come up to the Observatory, we can chat while the city lights up.',
    questions: 'Questions to ask Nova',
    talk: 'Talk to Nova',
  },
)

/** The Observatory's panel: Nova's invitation, questions to ask straight away, and the way up to the chat. */
export function NovaInvite() {
  const m = useMessages(messages)
  const suggestions = useChatSuggestions()
  return (
    <div className={styles.invite}>
      <p className={styles.bubble}>
        <b>Nova</b>
        {m.invite}
      </p>
      <ul className={styles.questions} aria-label={m.questions}>
        {suggestions.map((question) => (
          <li key={question}>
            <ButtonRouteLink variant="ghost" small to={`/nova?q=${encodeURIComponent(question)}`}>
              {question}
            </ButtonRouteLink>
          </li>
        ))}
      </ul>
      <ButtonRouteLink to="/nova" data-nova-look>
        {m.talk}
      </ButtonRouteLink>
    </div>
  )
}
