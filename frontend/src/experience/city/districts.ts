import { defineMessages, messagesFor, type Locale } from '../../i18n'
import type { AnchorId } from '../director/frameState'
import type { Emotion } from '../nova/face/faceState'

/** Nova's line the first time it presents a district during a visit (D14: said in the language of the moment). */
const intros = defineMessages(
  {
    central: 'Le Dôme central : tous les guichets de la ville, ouverts jour et nuit.',
    trois: 'Le Dôme 3. Un souci ? Décrivez-le en une phrase, je préviens le Haut Conseil.',
    serre: 'La Serre 1 nous nourrit et nous fait respirer. Tout est au vert.',
    conseil: 'La Tour du Conseil. Annonces et consignes pour toute la ville, ici.',
    observatoire: "L'Observatoire. Montez me voir, on discute sous les étoiles.",
    registre: 'Et voilà Terra Nova. Chaque demande et chaque réponse sont dans le registre.',
  },
  {
    central: 'The Central Dome: every counter in the city, open day and night.',
    trois: 'Dome 3. Something wrong? Describe it in one sentence and I’ll tell the High Council.',
    serre: 'Greenhouse 1 feeds us and keeps us breathing. All green here.',
    conseil: 'The Council Tower. Announcements and instructions for the whole city, right here.',
    observatoire: 'The Observatory. Come up and see me, we’ll chat under the stars.',
    registre: 'And there you have Terra Nova. Every request and every answer is in the registry.',
  },
)

type IntroId = keyof (typeof intros)['fr']

/** One district of the flyover, in camera pose order (see `CAMERA_POSES`): what Nova shows and says there. */
export interface District {
  /** landmark Nova points at, and the interface links its panel to */
  anchor?: AnchorId
  /** Nova's line the first time it presents the district during a visit (see `districtIntro`) */
  intro?: IntroId
  mood?: Emotion
}

export const DISTRICTS: readonly District[] = [
  {},
  { anchor: 'central', intro: 'central', mood: 'happy' },
  { anchor: 'trois', intro: 'trois' },
  { anchor: 'serre', intro: 'serre', mood: 'happy' },
  { anchor: 'conseil', intro: 'conseil', mood: 'focused' },
  { anchor: 'observatoire', intro: 'observatoire', mood: 'happy' },
  { intro: 'registre', mood: 'happy' },
]

/** The district's introduction in `locale` (the current language by default). */
export const districtIntro = (district: District, locale?: Locale): string | undefined =>
  district.intro ? messagesFor(intros, locale)[district.intro] : undefined

/** Every introduction in `locale`, for the voice to prepare them ahead. */
export const districtIntros = (locale?: Locale): readonly string[] => Object.values(messagesFor(intros, locale))
