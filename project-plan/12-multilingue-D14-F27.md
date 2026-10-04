# PLAN-12 : multilingue français / anglais (espace citoyen)

> **Réfs :** D14 · F27. **XP :** 1 080.
> **Dépend de :** PLAN-00 (couche `src/api`, session, formulaires).
> **Périmètre :** l'espace citoyen (`/`, `/ville/*`, `/nova`, `/equipe`, `/face`, `/transcription`). Le back-office (`/agent`, `/admin`) reste en français et n'est pas modifié.

## 1. Pourquoi ces demandes vont ensemble

| Réf | Besoin | Preuve que c'est fait |
|---|---|---|
| D14 | Choisir la langue de l'interface | Sélecteur FR / EN sur le sas, la barre de la ville, la console et le chat ; choix gardé par navigateur et enregistré sur le profil |
| F27 | Consulter les contenus traduits | L'API reçoit la langue (`?lang=`) et renvoie les contenus traduits par `ContentTranslation` ; les libellés du client sont traduits |

L'interface (D14) et les contenus (F27) suivent le même réglage : un seul choix de langue pilote les deux.

## 2. Existant côté backend (prêt)

- `lib/translations.ts` : `resolveLocale()` lit `?lang=`, puis `User.locale`, puis `Accept-Language`, puis `fr`. `translate()` superpose les traductions de `ContentTranslation` (services, catégories, démarches, annonces, alertes, quartiers, interruptions, lignes).
- `PATCH /api/me { locale }` enregistre la langue du profil.
- Le seed contient quelques traductions anglaises d'exemple (catégories, trois services).

## 3. Frontend

### Socle (`frontend/src/i18n/`)

- `locale.ts` : `Locale = 'fr' | 'en'`, store zustand persistant (`nova-locale` : `locale`, `chosen`), `useLocale()` (hook) et `currentLocale()` (hors React). Sur `/agent` et `/admin`, les deux renvoient toujours `fr` : les modules partagés avec le back-office (`api/errors`, `useApiForm`, `cityTime`…) restent en français là-bas sans test supplémentaire.
- `messages.ts` : `defineMessages(fr, en)` crée un dictionnaire typé, écrit à côté du code qui l'affiche. La version anglaise doit avoir exactement les clés et signatures de la française : une traduction manquante est une erreur de compilation. `useMessages(dict)` dans les composants, `messagesFor(dict)` ailleurs (stores, modèles, répliques de Nova).
- `LocaleSync.tsx` (monté dans `App.tsx`) : `<html lang>`, rechargement des données serveur au changement de langue, enregistrement de la langue choisie sur le profil du résident connecté (sans choix local, la langue du profil est adoptée).
- `api/client.ts` : chaque requête de l'espace citoyen envoie `?lang=` et `Accept-Language`. Les requêtes du back-office sont inchangées.
- `ui/LanguageSwitch` : sélecteur FR | EN (`variant="floating"` sur le sas).
- Formats : `lib/format.ts`, `lib/cityTime.ts` et les `Intl` des features suivent `localeTag()` (`fr-FR` / `en-GB`).

### Règles pour tout nouveau texte

- Aucun texte visible en dur : il passe par un dictionnaire `defineMessages`, dans les deux langues.
- Pas de constante de module contenant du texte : elle ne changerait jamais de langue. Lire le dictionnaire au rendu (`useMessages`) ou au moment où le texte est produit (`messagesFor`).
- Les contenus venant de l'API ne sont pas traduits côté client : on les traduit dans `ContentTranslation`.

## 4. Reste à faire

- Traductions anglaises des contenus du scénario de démo (seed) : services, démarches, annonces, alertes, quartiers. Sans elles, ces contenus restent en français en mode anglais.
- Page « Traductions » du back-office (toujours simulée), hors périmètre de ce plan.
- Notifications et e-mails générés par le serveur : ils sont écrits en français ; `User.locale` est disponible pour les traduire.

## 5. Version minimale

Le socle, le sélecteur et la traduction des écrans du parcours de démo (sas, ville, contact, Mon espace, rendez-vous).
