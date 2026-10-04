import type { AnchorId } from '../director/frameState'
import type { Emotion } from '../nova/face/faceState'

/** One district of the flyover, in camera pose order (see `CAMERA_POSES`): what Nova shows and says there. */
export interface District {
  /** landmark Nova points at, and the interface links its panel to */
  anchor?: AnchorId
  /** Nova's line the first time it presents the district during a visit */
  intro?: string
  mood?: Emotion
}

export const DISTRICTS: readonly District[] = [
  {},
  { anchor: 'central', intro: 'Le Dôme central : tous les guichets de la ville, ouverts jour et nuit.', mood: 'happy' },
  { anchor: 'trois', intro: 'Le Dôme 3. Un souci ? Décrivez-le en une phrase, je préviens le Haut Conseil.' },
  { anchor: 'serre', intro: 'La Serre 1 nous nourrit et nous fait respirer. Tout est au vert.', mood: 'happy' },
  { anchor: 'conseil', intro: 'La Tour du Conseil. Une question pour la mairie ? Écrivez ici, vous repartez avec une référence.', mood: 'focused' },
  { anchor: 'observatoire', intro: "L'Observatoire. Montez me voir, on discute sous les étoiles.", mood: 'happy' },
  { intro: 'Et voilà Terra Nova. Chaque demande et chaque réponse sont dans le registre.', mood: 'happy' },
]
