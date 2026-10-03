import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Icon, NovaMark } from '../../ui/Icon'
import type { ChatMessage } from './chatModel'
import { CHAT_SUGGESTIONS } from './chatScript'
import type { ChatStatus } from './useNovaChat'
import styles from './ChatPanel.module.css'

interface ChatPanelProps {
  messages: readonly ChatMessage[]
  status: ChatStatus
  onSend: (text: string) => void
  onStop: () => void
  /** the resident is composing (focused field with text in it), and each keystroke */
  onComposing?: (composing: boolean) => void
  onKeystroke?: () => void
}

const STATUS_LABEL: Record<ChatStatus, string> = { idle: 'en ligne', thinking: 'réfléchit…', streaming: 'vous répond…' }

/**
 * The conversation with Nova on observatory glass: header with Nova's state, the messages (a log that
 * screen readers announce once each reply is complete), suggestions, and the composer
 * (Enter sends, Shift+Enter breaks the line, Escape interrupts Nova).
 */
export function ChatPanel({ messages, status, onSend, onStop, onComposing, onKeystroke }: ChatPanelProps) {
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const busy = status !== 'idle'
  const last = messages.at(-1)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // the newest message stays in view while it streams in
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }, [messages, status])

  const composing = focused && draft.trim().length > 0
  useEffect(() => onComposing?.(composing), [composing, onComposing])

  // the field grows with the text, up to four lines
  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`
  }, [draft])

  const submit = (text: string) => {
    if (busy || !text.trim()) return
    onSend(text)
    setDraft('')
    inputRef.current?.focus()
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(draft)
    } else if (event.key === 'Escape' && busy) {
      onStop()
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="chat-title">
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          <NovaMark size={22} stroke={1.8} />
        </span>
        <div>
          <h1 className={styles.title} id="chat-title">
            Nova
          </h1>
          <p className={styles.state} data-status={status}>
            <i aria-hidden="true" /> {STATUS_LABEL[status]}
          </p>
        </div>
        <span className={styles.place}>Observatoire · nuit</span>
      </header>

      <div ref={logRef} className={styles.log} role="log" aria-label="Conversation avec Nova" aria-busy={busy} aria-live="polite">
        <ol className={styles.thread}>
          {messages.map((message) => (
            <li key={message.id} className={styles.message} data-role={message.role}>
              <span className={styles.author}>{message.role === 'nova' ? 'Nova' : 'Vous'}</span>
              <p>
                {message.text}
                {message === last && status === 'streaming' && <i className={styles.caret} aria-hidden="true" />}
              </p>
            </li>
          ))}
          {status === 'thinking' && (
            <li className={styles.message} data-role="nova">
              <span className={styles.author}>Nova</span>
              <span className={styles.srOnly}>réfléchit…</span>
              <span className={styles.dots} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </li>
          )}
        </ol>
      </div>

      <div className={styles.suggestions}>
        {CHAT_SUGGESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" disabled={busy} onClick={() => submit(suggestion)}>
            {suggestion}
          </button>
        ))}
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <label className={styles.srOnly} htmlFor="chat-input">
          Votre message à Nova
        </label>
        <textarea
          ref={inputRef}
          id="chat-input"
          rows={1}
          value={draft}
          placeholder="Écrivez à Nova…"
          enterKeyHint="send"
          onChange={(e) => {
            setDraft(e.target.value)
            onKeystroke?.()
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {busy ? (
          <button type="button" className={styles.send} onClick={onStop} aria-label="Interrompre Nova">
            <Icon name="stop" />
          </button>
        ) : (
          <button type="submit" className={styles.send} disabled={!draft.trim()} aria-label="Envoyer" data-nova-look>
            <Icon name="send" />
          </button>
        )}
      </form>
      <p className={styles.note}>Démonstration : les réponses de Nova sont simulées dans la page.</p>
    </section>
  )
}
