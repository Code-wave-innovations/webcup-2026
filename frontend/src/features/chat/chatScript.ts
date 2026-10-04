import type { Emotion } from '../../experience/nova/face/faceState'
import { currentLocale, defineMessages, messagesFor, useMessages, type Locale } from '../../i18n'
import type { ChatContext, ChatGesture } from './chatModel'

export interface ScriptedReply {
  text: string
  emotion: Emotion
  gesture?: ChatGesture
}

const messages = defineMessages(
  {
    /** Suggestions offered under the conversation (they match the script). */
    suggestions: ['Où en est ma demande TN-0416 ?', 'Quels services sont ouverts ce soir ?', 'Raconte-moi Terra Nova'],
    request: "Votre demande TN-0416 est prise en charge : l'équipe d'entretien du Dôme 3 passe demain matin. Je vous préviens ici dès qu'elle est résolue.",
    services:
      "Ce soir, presque tout est ouvert : la clinique du Dôme 1 (environ 10 min d'attente), le logement, l'eau et l'énergie. Seule la navette de l'anneau nord reprend à 20 h.",
    story: (name: string) =>
      `Terra Nova est la première ville de la planète : six dômes, une serre qui nous nourrit et un Haut Conseil élu par les habitants. Moi, je veille sur tout ça. Et sur vous, ${name}.`,
    alert: 'Aucune alerte en cours. Si le Haut Conseil en lance une, je vous préviens ici et sur tous les écrans de la ville, avec la consigne à suivre.',
    thanks: "Avec plaisir ! Aider les habitants, c'est ma partie préférée de la journée.",
    greeting: (name: string) => `Bonsoir ${name} ! Belle vue d'ici, non ? Posez-moi vos questions sur la ville, vos démarches ou votre demande en cours.`,
    fallback:
      "Je n'ai pas encore la réponse à ça : je serai bientôt branché sur les données de la ville. En attendant, demandez-moi vos démarches, les services ouverts ou l'histoire de Terra Nova.",
  },
  {
    suggestions: ['Where is my request TN-0416?', 'Which services are open tonight?', 'Tell me about Terra Nova'],
    request: "Your request TN-0416 is being handled: the Dome 3 maintenance team is coming tomorrow morning. I'll let you know here as soon as it's resolved.",
    services:
      "Almost everything is open tonight: the Dome 1 clinic (about a 10-minute wait), housing, water and energy. Only the north ring shuttle is out, back at 8 pm.",
    story: (name) =>
      `Terra Nova is the planet's first city: six domes, a greenhouse that feeds us and a High Council elected by the residents. I watch over all of it. And over you, ${name}.`,
    alert: "No alerts right now. If the High Council issues one, I'll warn you here and on every screen in the city, with what to do.",
    thanks: 'My pleasure! Helping residents is my favourite part of the day.',
    greeting: (name) => `Good evening, ${name}! Lovely view from up here, isn't it? Ask me about the city, your formalities or your current request.`,
    fallback:
      "I don't have the answer to that yet: I'll soon be connected to the city's data. In the meantime, ask me about your formalities, which services are open or the story of Terra Nova.",
  },
)

type Lines = (typeof messages)['fr']

interface Rule {
  /** any of these words (lower case, without accents, French and English) starting a word in the message triggers the reply */
  words: readonly string[]
  reply: (lines: Lines, context: ChatContext) => ScriptedReply
}

/** The suggestions in the visitor's language (re-renders on a language switch). */
export const useChatSuggestions = (): readonly string[] => useMessages(messages).suggestions

/** The suggestions in `locale` (the current language by default), outside React. */
export const chatSuggestions = (locale: Locale = currentLocale()): readonly string[] => messagesFor(messages, locale).suggestions

const RULES: readonly Rule[] = [
  {
    words: ['tn-0416', 'demande', 'signalement', 'fuite', 'dossier', 'request', 'leak', 'complaint', 'my case'],
    reply: (m) => ({ text: m.request, emotion: 'focused' }),
  },
  {
    words: ['service', 'ouvert', 'horaire', 'clinique', 'guichet', 'open', 'hours', 'clinic', 'counter'],
    reply: (m) => ({ text: m.services, emotion: 'happy' }),
  },
  {
    words: ['terra nova', 'raconte', 'histoire', 'ville', 'qui es-tu', 'qui es tu', 'tell me', 'story', 'history', 'city', 'who are you'],
    reply: (m, { name }) => ({ text: m.story(name), emotion: 'happy', gesture: 'hop' }),
  },
  {
    words: ['alerte', 'danger', 'securite', 'urgence', 'alert', 'safety', 'security', 'emergency'],
    reply: (m) => ({ text: m.alert, emotion: 'focused' }),
  },
  {
    words: ['merci', 'super', 'genial', 'bravo', 'thank', 'great', 'awesome', 'well done', 'cheers'],
    reply: (m) => ({ text: m.thanks, emotion: 'happy', gesture: 'celebrate' }),
  },
  {
    words: ['bonjour', 'salut', 'coucou', 'bonsoir', 'hello', 'good evening', 'good morning', 'good afternoon', 'hey'],
    reply: (m, { name }) => ({ text: m.greeting(name), emotion: 'happy', gesture: 'wave' }),
  },
]

/** Lower case, without accents: what the rules compare. */
export const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The message as words separated by single spaces, with a leading space, so that a keyword only matches the start of a word ("hey" is not in "they"). */
const words = (text: string) => ` ${normalize(text).replace(/[^a-z0-9-]+/g, ' ')}`

/**
 * The scripted answer to a resident's message (first matching rule, otherwise an honest "not yet"), in `locale`
 * (the current language by default). The keywords of both languages are recognised whatever the language.
 */
export function scriptedReply(message: string, context: ChatContext, locale: Locale = currentLocale()): ScriptedReply {
  const said = words(message)
  const lines = messagesFor(messages, locale)
  const rule = RULES.find((r) => r.words.some((word) => said.includes(` ${word}`)))
  return rule ? rule.reply(lines, context) : { text: lines.fallback, emotion: 'sad' }
}
