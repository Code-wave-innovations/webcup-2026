import { useEffect, useRef } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import type { Session } from '../../features/auth/authService'
import { useAuthStore } from '../../features/auth/authStore'
import { ChatPanel } from '../../features/chat/ChatPanel'
import { scriptedChatService } from '../../features/chat/chatService'
import { useNovaChat } from '../../features/chat/useNovaChat'
import { ConsolePage } from '../Console/ConsolePage'
import styles from './LightChat.module.css'

/** F96: the conversation with Nova in the light version: the same chat, without the Observatory, the 3D or the voice. */
export default function LightChatPage() {
  const session = useAuthStore((s) => s.session)
  const { search } = useLocation()
  if (!session) return <Navigate to={{ pathname: '/', search }} replace />
  return <LightChat session={session} />
}

function LightChat({ session }: { session: Session }) {
  const chat = useNovaChat(scriptedChatService, { name: session.name })
  const [params, setParams] = useSearchParams()
  const asked = useRef(false)

  // a suggestion picked elsewhere (`?q=`) is asked at once
  const question = params.get('q')
  const { send } = chat
  useEffect(() => {
    if (!question || asked.current) return
    asked.current = true
    void send(question)
    setParams({}, { replace: true })
  }, [question, send, setParams])

  return (
    <ConsolePage title="Parler à Nova" lead="Une question sur la ville, une démarche ou votre demande : Nova vous répond par écrit.">
      <div className={styles.chat}>
        <ChatPanel messages={chat.messages} status={chat.status} onSend={(text) => void chat.send(text)} onStop={chat.stop} />
      </div>
    </ConsolePage>
  )
}
