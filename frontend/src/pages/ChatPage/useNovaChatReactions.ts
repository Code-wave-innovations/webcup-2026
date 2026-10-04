import { useCallback, useEffect } from 'react'
import { novaVoice } from '../../experience/audio/novaVoice'
import { nova } from '../../experience/nova/behavior/novaStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import type { ChatEvent } from '../../features/chat/useNovaChat'

/**
 * Makes Nova act out the conversation (the chat feature does not know Nova): it listens while the resident
 * types, thinks while the answer is prepared, talks while it streams, then shows how it feels and reads
 * the reply aloud when the sound is on.
 */
export function useNovaChatReactions() {
  useEffect(
    () => () => {
      novaVoice.hush()
      novaScenes.leaveObservatory()
    },
    [],
  )

  const onEvent = useCallback((event: ChatEvent) => {
    switch (event.type) {
      case 'thinking':
        novaVoice.hush()
        novaScenes.listen(false)
        novaScenes.ponder(true)
        break
      case 'streaming':
        novaScenes.ponder(false)
        novaScenes.answer(true)
        break
      case 'replied':
        novaScenes.replied(event.message.emotion ?? 'neutral', event.gesture)
        novaVoice.say(event.message.text)
        break
      case 'interrupted':
        novaVoice.hush()
        novaScenes.ponder(false)
        novaScenes.answer(false)
        nova.emote('surprised', 1.2)
        break
    }
  }, [])

  return { onEvent, onComposing: novaScenes.listen, onKeystroke: nova.hear }
}
