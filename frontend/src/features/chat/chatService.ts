import type { ChatChunk, ChatService } from './chatModel'
import { scriptedReply } from './chatScript'

interface ScriptedOptions {
  /** waits `ms`, rejecting when `signal` aborts (injectable for tests) */
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
  random?: () => number
}

const abortableWait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

/**
 * Demo backend: Nova "thinks" 0.6 to 1.2 s, then its scripted answer streams in word by word (18 to 30 ms
 * per character, like a model's tokens). Aborting stops the stream at the next word.
 */
export function createScriptedChatService({ wait = abortableWait, random = Math.random }: ScriptedOptions = {}): ChatService {
  return {
    async *reply(history, context, signal): AsyncGenerator<ChatChunk> {
      const last = [...history].reverse().find((m) => m.role === 'resident')
      const answer = scriptedReply(last?.text ?? '', context)
      yield { type: 'thinking' }
      await wait(600 + random() * 600, signal)
      const words = answer.text.split(/(?<= )/)
      for (const word of words) {
        yield { type: 'text', text: word }
        await wait(word.length * (18 + random() * 12), signal)
      }
      yield { type: 'done', emotion: answer.emotion, gesture: answer.gesture }
    },
  }
}

export const scriptedChatService = createScriptedChatService()
