import { useEffect, useRef } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { novaVoice } from '../../experience/audio/novaVoice'
import { debugJump } from '../../experience/director/debugParams'
import { director } from '../../experience/director/director'
import { useDirectorStore } from '../../experience/director/directorStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { ChatPanel } from '../../features/chat/ChatPanel'
import { scriptedChatService } from '../../features/chat/chatService'
import { CHAT_SUGGESTIONS, scriptedReply } from '../../features/chat/chatScript'
import { useNovaChat } from '../../features/chat/useNovaChat'
import { useBodyClass } from '../../hooks/useBodyClass'
import { useReducedMotion } from '../../hooks/useMediaQuery'
import { Icon, NovaMark } from '../../ui/Icon'
import { CITY_SECTIONS } from '../CityPage/citySections'
import { useNovaChatReactions } from './useNovaChatReactions'
import styles from './ChatPage.module.css'

const OBSERVATORY_SECTION = CITY_SECTIONS.findIndex((s) => s.id === 'observatoire')
/** a question asked from the city is sent once the camera has reached the balcony */
const ASK_AFTER_MS = 1900

/** Act V: the Observatory at night, Nova on the balcony and the conversation beside it. Requires a session. */
export default function ChatPage() {
  const session = useAuthStore((s) => s.session)
  const { search } = useLocation()
  // a debug jump (`?vue`) signs in by itself once the film has landed
  if (!session) return debugJump ? null : <Navigate to={{ pathname: '/', search }} replace />
  return <Observatory session={session} />
}

function Observatory({ session }: { session: Session }) {
  useBodyClass('is-locked')
  const status = useDirectorStore((s) => s.status)
  const phase = useDirectorStore((s) => s.phase)
  const arrived = phase === 'city'
  const reduced = useReducedMotion()
  const [params, setParams] = useSearchParams()
  const reactions = useNovaChatReactions()
  const chat = useNovaChat(scriptedChatService, { name: session.name }, reactions.onEvent)
  const asked = useRef(false)

  // reload or deep link while the film waits in the cockpit: land by the Observatory
  useEffect(() => {
    const store = useDirectorStore.getState()
    if (director.phase === 'explore') director.exitExplore(true)
    if (status === 'ready' && director.phase === 'approach') director.land(OBSERVATORY_SECTION)
    else if (status === 'unsupported' && store.phase !== 'city') store.setPhase('city')
  }, [status])

  // the camera rises to the balcony, and back down to the flyover when leaving
  useEffect(() => {
    director.visitObservatory(true)
    return () => director.visitObservatory(false)
  }, [])

  useEffect(() => {
    if (arrived) return novaScenes.arriveAtObservatory()
  }, [arrived])

  // the answers to the suggestions are generated ahead, so that Nova says them as soon as they are written
  useEffect(() => {
    novaVoice.warm(CHAT_SUGGESTIONS.map((suggestion) => scriptedReply(suggestion, { name: session.name }).text))
  }, [session.name])

  // the welcome bubble is read aloud once Nova is on the balcony (the replies by the reactions)
  const welcome = chat.messages[0]?.role === 'nova' ? chat.messages[0].text : ''
  useEffect(() => {
    if (arrived && welcome) novaVoice.say(welcome)
  }, [arrived, welcome])

  // a suggestion picked in the city (`?q=`) is asked as soon as Nova is there
  const question = params.get('q')
  const { send } = chat
  useEffect(() => {
    if (!arrived || !question || asked.current) return
    asked.current = true
    const timer = setTimeout(() => {
      void send(question)
      setParams({}, { replace: true })
    }, reduced ? 0 : ASK_AFTER_MS)
    return () => clearTimeout(timer)
  }, [arrived, question, send, setParams, reduced])

  return (
    <div className={styles.page} hidden={!arrived}>
      <header className={styles.bar}>
        <Link className={styles.back} to="/ville#observatoire">
          <Icon name="back" /> <span>Retour à la ville</span>
        </Link>
        <div className={styles.brand} aria-hidden="true">
          <NovaMark />
          <span>NOVA</span>
        </div>
      </header>
      <main className={styles.stage}>
        <div className={styles.chat}>
          <ChatPanel
            messages={chat.messages}
            status={chat.status}
            onSend={(text) => void chat.send(text)}
            onStop={chat.stop}
            onComposing={reactions.onComposing}
            onKeystroke={reactions.onKeystroke}
          />
        </div>
      </main>
    </div>
  )
}
