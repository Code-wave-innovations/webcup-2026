import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatContext, ChatGesture, ChatMessage, ChatService } from './chatModel'

export type ChatStatus = 'idle' | 'thinking' | 'streaming'

/** What happens in the conversation, for whoever wants to react to it (the page makes Nova act it out). */
export type ChatEvent =
  | { type: 'thinking' }
  | { type: 'streaming' }
  | { type: 'replied'; message: ChatMessage; gesture?: ChatGesture }
  | { type: 'interrupted' }

/**
 * The conversation with Nova: the messages, the reply being streamed, sending and interrupting.
 * The service is the only thing that knows where answers come from.
 */
export function useNovaChat(service: ChatService, context: ChatContext, onEvent?: (event: ChatEvent) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 0, role: 'nova', text: `Bienvenue à l'Observatoire, ${context.name}. Je vous écoute : une question sur la ville, une démarche, votre demande ?`, emotion: 'happy' },
  ])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const nextId = useRef(1)
  const running = useRef<AbortController | null>(null)
  const history = useRef(messages)
  const emit = useRef(onEvent)
  const contextRef = useRef(context)
  useEffect(() => {
    emit.current = onEvent
    contextRef.current = context
    history.current = messages
  })

  useEffect(() => () => running.current?.abort(), [])

  const send = useCallback(
    async (text: string) => {
      const said = text.trim()
      if (!said || running.current) return
      const controller = new AbortController()
      running.current = controller
      const question: ChatMessage = { id: nextId.current++, role: 'resident', text: said }
      const answer: ChatMessage = { id: nextId.current++, role: 'nova', text: '' }
      const conversation = [...history.current, question]
      setMessages(conversation)
      try {
        for await (const chunk of service.reply(conversation, contextRef.current, controller.signal)) {
          if (chunk.type === 'thinking') {
            setStatus('thinking')
            emit.current?.({ type: 'thinking' })
          } else if (chunk.type === 'text') {
            if (!answer.text) {
              setStatus('streaming')
              emit.current?.({ type: 'streaming' })
            }
            answer.text += chunk.text
            const partial = { ...answer }
            setMessages([...conversation, partial])
          } else {
            const complete = { ...answer, emotion: chunk.emotion }
            setMessages([...conversation, complete])
            emit.current?.({ type: 'replied', message: complete, gesture: chunk.gesture })
          }
        }
      } catch {
        // interrupted: keep what was said so far
        if (answer.text) setMessages([...conversation, { ...answer, text: `${answer.text.trimEnd()}…` }])
        emit.current?.({ type: 'interrupted' })
      } finally {
        running.current = null
        setStatus('idle')
      }
    },
    [service],
  )

  const stop = useCallback(() => running.current?.abort(), [])

  return { messages, status, send, stop }
}
