import type { Emotion } from '../../experience/nova/face/faceState'
import type { ChatContext, ChatGesture } from './chatModel'

export interface ScriptedReply {
  text: string
  emotion: Emotion
  gesture?: ChatGesture
}

interface Rule {
  /** any of these words (lower case, without accents) triggers the reply */
  words: readonly string[]
  reply: (context: ChatContext) => ScriptedReply
}

/** Suggestions offered under the conversation (they match the script). */
export const CHAT_SUGGESTIONS: readonly string[] = ['Où en est ma demande TN-0416 ?', 'Quels services sont ouverts ce soir ?', 'Raconte-moi Terra Nova']

const RULES: readonly Rule[] = [
  {
    words: ['tn-0416', 'demande', 'signalement', 'fuite', 'dossier'],
    reply: () => ({
      text: "Votre demande TN-0416 est prise en charge : l'équipe d'entretien du Dôme 3 passe demain matin. Je vous préviens ici dès qu'elle est résolue.",
      emotion: 'focused',
    }),
  },
  {
    words: ['service', 'ouvert', 'horaire', 'clinique', 'guichet'],
    reply: () => ({
      text: "Ce soir, presque tout est ouvert : la clinique du Dôme 1 (environ 10 min d'attente), le logement, l'eau et l'énergie. Seule la navette de l'anneau nord reprend à 20 h.",
      emotion: 'happy',
    }),
  },
  {
    words: ['terra nova', 'raconte', 'histoire', 'ville', 'qui es-tu', 'qui es tu'],
    reply: ({ name }) => ({
      text: `Terra Nova est la première ville de la planète : six dômes, une serre qui nous nourrit et un Haut Conseil élu par les habitants. Moi, je veille sur tout ça. Et sur vous, ${name}.`,
      emotion: 'happy',
      gesture: 'hop',
    }),
  },
  {
    words: ['alerte', 'danger', 'securite', 'urgence'],
    reply: () => ({
      text: "Aucune alerte en cours. Si le Haut Conseil en lance une, je vous préviens ici et sur tous les écrans de la ville, avec la consigne à suivre.",
      emotion: 'focused',
    }),
  },
  {
    words: ['merci', 'super', 'genial', 'bravo'],
    reply: () => ({ text: "Avec plaisir ! Aider les habitants, c'est ma partie préférée de la journée.", emotion: 'happy', gesture: 'celebrate' }),
  },
  {
    words: ['bonjour', 'salut', 'coucou', 'bonsoir', 'hello'],
    reply: ({ name }) => ({
      text: `Bonsoir ${name} ! Belle vue d'ici, non ? Posez-moi vos questions sur la ville, vos démarches ou votre demande en cours.`,
      emotion: 'happy',
      gesture: 'wave',
    }),
  },
]

const FALLBACK: ScriptedReply = {
  text: "Je n'ai pas encore la réponse à ça : je serai bientôt branché sur les données de la ville. En attendant, demandez-moi vos démarches, les services ouverts ou l'histoire de Terra Nova.",
  emotion: 'sad',
}

/** Lower case, without accents: what the rules compare. */
export const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The scripted answer to a resident's message (first matching rule, otherwise an honest "not yet"). */
export function scriptedReply(message: string, context: ChatContext): ScriptedReply {
  const said = normalize(message)
  const rule = RULES.find((r) => r.words.some((word) => said.includes(word)))
  return rule ? rule.reply(context) : FALLBACK
}
