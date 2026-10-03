import { useCallback, useEffect, useRef } from 'react'
import { nova } from '../../experience/nova/behavior/novaStore'
import { novaScenes } from '../../experience/nova/behavior/scenes'
import type { Inconclusive } from '../../features/auth/authService'
import type { LoginActivity, LoginField } from '../../features/auth/loginActivity'

/** What Nova says when the face engine cannot let the visitor in. */
const FACE_UNDECIDED: Record<Inconclusive, string> = {
  unknown: "Je ne connais pas encore ce visage. Entrez votre code, je m'en souviendrai.",
  noFace: 'Je vous vois mal… approchez-vous, face à la lumière.',
  unavailable: 'Mon module de reconnaissance ne répond pas. Passons par le code.',
  mismatch: 'Ce visage ne correspond pas à l’identifiant saisi. Vérifiez l’e-mail, ou entrez avec votre code.',
}

/**
 * Translates what happens at the access control into Nova's reactions (the hologram itself does not know
 * Nova): it follows the caret, hides its eyes for the code, peeks when it is shown, thinks while it is
 * checked, shakes its head at a refusal, sulks while locked and celebrates the access.
 */
export function useNovaLoginReactions(): (activity: LoginActivity) => void {
  const seen = useRef({ field: null as LoginField | null, revealed: false })

  useEffect(() => () => novaScenes.leaveAirlock(), [])

  return useCallback((activity: LoginActivity) => {
    const state = seen.current
    // after a verdict, back to what the focused field asks for
    const resume = () => {
      if (state.field === 'code') novaScenes.hideEyes(true, state.revealed)
      else if (state.field === 'identifier') novaScenes.watchTyping(null)
    }
    switch (activity.type) {
      case 'focus':
        state.field = activity.field
        if (activity.field === 'code') novaScenes.hideEyes(true, state.revealed)
        else if (activity.field === 'identifier') novaScenes.watchTyping(null)
        else novaScenes.stopWatching()
        break
      case 'typing':
        if (activity.field === 'identifier') novaScenes.watchTyping(activity.caret)
        else novaScenes.fidget()
        break
      case 'identifierValid':
        if (activity.valid) novaScenes.identifierLooksRight()
        break
      case 'reveal':
        state.revealed = activity.shown
        if (state.field === 'code') novaScenes.hideEyes(true, activity.shown)
        break
      case 'capsLock':
        if (activity.on) novaScenes.capsLock(activity.hint)
        break
      case 'checking':
        novaScenes.checking()
        break
      case 'refused':
        novaScenes.refused(activity.left)
        resume()
        break
      case 'locked':
        novaScenes.locked(activity.seconds)
        break
      case 'unlocked':
        novaScenes.unlocked()
        resume()
        break
      case 'granted':
        novaScenes.granted(activity.name)
        break
      // the face scanner: Nova looks into the camera, then says why the face did not open the airlock
      case 'faceScan':
        if (activity.open) novaScenes.watchTyping(activity.lens)
        else novaScenes.stopWatching()
        break
      case 'faceUndecided':
        nova.hold('think', false)
        if (activity.reason === 'noFace') nova.emote('surprised', 1.2)
        nova.say(FACE_UNDECIDED[activity.reason], activity.reason === 'unavailable' ? 'sad' : 'surprised')
        break
      case 'faceLinked':
        nova.say(`C'est noté, ${activity.name} : la prochaine fois, un regard suffira.`, 'happy')
        break
    }
  }, [])
}
