import type { Emotion } from '../../experience/nova/face/faceState'

export type ChatRole = 'resident' | 'nova'

export interface ChatMessage {
  id: number
  role: ChatRole
  text: string
  /** how Nova feels about what it said (shown on its face once the reply is complete) */
  emotion?: Emotion
}

/** What a reply stream yields: Nova is thinking, then words arrive, then it is done. */
export type ChatChunk = { type: 'thinking' } | { type: 'text'; text: string } | { type: 'done'; emotion: Emotion; gesture?: ChatGesture }

/** A gesture Nova makes once its reply is complete. */
export type ChatGesture = 'wave' | 'celebrate' | 'hop'

/**
 * Nova's conversation backend. The demo answers from a script; a real one streams a server reply
 * (Server-Sent Events) with the same chunks, without touching the interface.
 */
export interface ChatService {
  reply(history: readonly ChatMessage[], context: ChatContext, signal: AbortSignal): AsyncIterable<ChatChunk>
}

export interface ChatContext {
  /** the resident's first name */
  name: string
}
