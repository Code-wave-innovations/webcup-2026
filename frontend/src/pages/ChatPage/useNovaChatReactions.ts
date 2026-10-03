import { useCallback, useEffect } from 'react'
import { nova } from '../../experience/nova/behavior/novaStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import type { ChatEvent } from '../../features/chat/useNovaChat'

/**
 * Makes Nova act out the conversation (the chat feature does not know Nova): it listens while the resident
 * types, thinks while the answer is prepared, talks while it streams, then shows how it feels.
 */
export function useNovaChatReactions() {
  useEffect(() => () => novaScenes.leaveObservatory(), [])

  const onEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'thinking':
        novaScenes.listen(false)
        novaScenes.ponder(true)
        break
      case 'streaming':
        novaScenes.ponder(false)
        novaScenes.answer(true)
        break
      case 'replied':
        novaScenes.replied(event.message.emotion ?? 'neutral', event.gesture)
        break
      case 'interrupted':
        novaScenes.ponder(false)
        novaScenes.answer(false)
        nova.emote('surprised', 1.2)
        break
    }
  }, [])

  return { onEvent, onComposing: novaScenes.listen, onKeystroke: nova.hear }
}
