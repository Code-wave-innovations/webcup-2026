import { speakMessage, stopSpeaking, warmSpeech } from '../../hooks/useSpeakMessage'
import { useSoundStore } from './soundStore'

/**
 * Nova reads its lines aloud while the sound is on. The bubble's lines are read by the SoundDirector;
 * the pages call this for what Nova says elsewhere (the chat's replies).
 */
export const novaVoice = {
  say(text: string): void {
    if (useSoundStore.getState().enabled) void speakMessage(text)
  },
  hush: stopSpeaking,
  /** generates lines Nova is about to say, so that they play at once (nothing while the sound is off) */
  warm(texts: readonly string[]): void {
    if (useSoundStore.getState().enabled) void warmSpeech(texts)
  },
}
