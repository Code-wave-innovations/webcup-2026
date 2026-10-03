# PLAN-08 : accessibilité et confort de lecture

> **Réfs :** D20 · F21 · F23 · F24 · F41 · F42 · F43 · F44
> **XP :** 4 710, le plus gros total.
> **Dépend de :** PLAN-00, car les primitives de formulaire sont posées en F6.
> **Portée :** transversal. Ce plan s'applique à toutes les pages livrées par les autres plans, côté citoyen comme côté back-office.
> **Effort :** environ 6 h pour les fondations et la passe finale, puis environ 20 minutes de vérification à la fin de chaque plan.

## 1. Pourquoi ces demandes vont ensemble

D20 fixe l'objectif commun : rendre la plateforme « utilisable par tous les habitants, y compris les personnes en situation de handicap […] sans isoler ces utilisateurs dans un parcours incomplet ». Les sept autres demandes le déclinent, chacune pour un besoin précis.

Toutes s'appuient sur les mêmes leviers :
- les préférences d'affichage ;
- les tokens CSS ;
- les règles des composants ;
- un même protocole de test.

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| D20 | Service Inclusion | Plateforme utilisable par tous, sans parcours au rabais | Toutes les fonctions disponibles en « Affichage simple » et déclaration d'accessibilité publiée |
| F21 | Marc Delcourt | Comprendre les boutons, les formulaires et la structure avec un lecteur d'écran | Parcours complets réussis avec VoiceOver ou NVDA |
| F23 | Jean Morel | Plus de contraste, une interface moins fatigante | Mode contraste élevé |
| F24 | Sophie Nguyen | Agrandir le texte sans chevauchements | Taille du texte jusqu'à 200 %, sans casse |
| F41 | Marc Delcourt | Tout faire au clavier | Parcours complets au clavier seul, focus toujours visible |
| F42 | Service Inclusion | Formulaires, composants et erreurs accessibles aux technologies d'assistance | Audit de tous les formulaires et erreurs reliées aux champs |
| F43 | Citoyenne | Distinguer les informations malgré un daltonisme | Aucune information portée par la couleur seule, mode « couleurs sûres » |
| F44 | Citoyen | Zoomer sans casser l'affichage | Zoom à 400 % et largeur de 320 px sans défilement horizontal |

## 2. Existant

### Points forts

- Tokens CSS centralisés dans `styles/tokens.css`.
- Règle `prefers-reduced-motion` globale dans `styles/base.css`, plus le hook `useReducedMotion`.
- Focus visible, `aria-live` sur le message radio du sas, titre focalisé à l'arrivée en ville.
- Back-office :
  - `MotionConfig reducedMotion="user"` ;
  - tableaux avec `aria-sort` ;
  - modales et tiroirs qui gardent le focus ;
  - palette des graphiques validée pour le daltonisme, avec une vue tableau pour chaque graphique ;
  - tableaux transformés en cartes sous 860 px.
- `User.preferences` existe déjà côté backend (JSON libre, modifiable par `PATCH /api/me`).

### Risques

- Expérience 3D en plein écran : canvas, cinématiques, défilement piloté par `useCityScroll`.
- Panneaux en verre translucide, dont le contraste varie selon ce qui passe derrière.
- Environ 170 tailles de police déclarées en `px` dans les modules CSS, côté citoyen et back-office.
- Vocabulaire de science-fiction (traité au PLAN-09, D13).
- Widgets maison : puces de catégorie, hologramme de connexion.

## 3. Décisions

- **Cible :** RGAA 4.1, soit WCAG 2.2 niveau AA, sur l'espace citoyen et sur le back-office. En mode contraste élevé, on vise l'AAA (7:1).
- **Pas de « version accessible » séparée (D20) :** mêmes routes et mêmes fonctions pour tous. Les préférences ne changent que le rendu.
- **Mode « Affichage simple » :**
  - pas de scène 3D ni de cinématique, mise en page linéaire ;
  - il donne accès à toutes les fonctions ;
  - il est proposé, jamais imposé ;
  - il s'active de lui-même quand WebGL est indisponible, cas déjà géré par `status === 'unsupported'`.

## 4. Préférences d'affichage (F23, F24, F43, F44, animations)

Le modèle est dans `src/a11y/preferences.ts`. Il est partagé par le citoyen et le back-office ; c'est un module neutre, pas un import du back-office.

| Clé | Valeurs | Effet |
|---|---|---|
| `contrast` | `standard`, `high` | F23 : panneaux opaques sans flou, texte quasi blanc sur fond quasi noir, bordures de 2 px, anneau de focus de 3 px, texte secondaire éclairci |
| `textScale` | 1, 1.15, 1.3, 1.5, 2 | F24 : variable `--text-scale` sur `html` ; toutes les tailles sont en `rem` |
| `colorVision` | `standard`, `safe` | F43 : palette sûre (bleu et orange au lieu de rouge et vert), motifs sur les jauges, graphiques et repères, liens toujours soulignés |
| `motion` | `system`, `reduced` | Coupe les animations et les cinématiques, en plus du réglage système |
| `scene` | `auto`, `simple` | « Affichage simple » sans 3D (D20, F21) |
| `spacing` | `standard`, `wide` | Interligne de 1,8 et espacement accru entre lettres et mots (WCAG 1.4.12) |

### Application

- Attributs posés sur `<html>` : `data-contrast`, `data-cvd`, `data-motion`, `data-scene`, `data-spacing`, plus la variable `--text-scale`.
- Les surcharges vivent dans `styles/a11y.css` côté citoyen et dans `backoffice/a11y.css` côté back-office.
- Les tokens sont redéfinis par ces sélecteurs ; aucun composant ne teste lui-même la préférence.

### Stockage

- Dans `localStorage`, ce qui fonctionne avant la connexion, y compris sur le sas.
- Synchronisé dans `User.preferences.display` à la connexion (`PATCH /api/me`).
- Une fois connecté, c'est la valeur du serveur qui fait foi.
- Côté backend, valider la forme avec zod, en tolérant les clés inconnues (`passthrough`).

### Panneau « Affichage & accessibilité »

- Il est accessible depuis :
  - un bouton permanent dans la `TopBar` citoyenne ;
  - le sas, **avant la connexion** ;
  - le menu profil du back-office ;
  - la page profil (PLAN-01).
- Chaque réglage s'applique immédiatement, avec un aperçu. Un bouton « Réinitialiser » revient aux valeurs par défaut.

### Réglages système respectés

- `prefers-reduced-motion`.
- `prefers-contrast: more`, qui active le contraste élevé par défaut.
- `forced-colors: active`, le mode contraste élevé de Windows : bordures visibles, icônes en `currentColor`, aucune information portée par un fond.

## 5. Chantiers par demande

### F21 : lecteur d'écran

- **Structure :**
  - `header`, `nav`, `main` et `footer` sur chaque page ;
  - un seul `h1` par page, titres sans saut de niveau ;
  - `lang="fr"` sur le document.
- **Canvas et décor :**
  - le canvas 3D porte `aria-hidden` ;
  - la télémétrie et le réticule sont décoratifs (`aria-hidden`) ;
  - le message radio garde son `aria-live` discret.
- **Cinématique d'arrivée :**
  - annoncée par « Connexion réussie, chargement de la ville » ;
  - passable avec le bouton existant et avec la touche Échap ;
  - le focus arrive sur le `h1` de la ville, ce qui est déjà le cas.
- **Navigation entre pages (console) :** le focus va sur le `h1` et le titre du document change (PLAN-00, F4).
- **Annonces vocales (`aria-live`) :**
  - état d'un envoi ;
  - nombre de résultats de recherche ;
  - nouvelles notifications ;
  - erreurs.
- **Boutons à icône seule :** un `aria-label` explicite. Les états passent par `aria-pressed`, `aria-expanded` et `aria-current`.
- **Survol 3D :**
  - les sections se lisent comme un document, dans l'ordre ;
  - le rail et les liens d'ancre fonctionnent sans souris ;
  - en « Affichage simple », la page devient une suite de sections sans défilement piloté.

### F23 : basse vision

- Thème contraste élevé, décrit au § 4.
- Contraste du texte normal : au moins 4,5:1 en thème standard. À vérifier en priorité pour `--color-text-muted` sur le verre, sur le fond le plus clair de la scène. Contraste des composants : au moins 3:1.
- Cibles cliquables d'au moins 44 px.
- Aucune information essentielle en dessous de 14 px.
- Le texte ne s'affiche jamais directement sur la 3D : il y a toujours un panneau dessous.

### F24 et F44 : taille du texte et zoom

- **Conversion en `rem` :** les `font-size` en `px` des `*.module.css` (dans `pages/`, `features/`, `ui/`, `backoffice/`) passent en `rem`, par un script qui remplace `Npx` par `N/16rem`. Les espacements liés au texte passent en `em`.
- **Rien ne doit couper le texte :**
  - pas de hauteur fixe sur un conteneur de texte : utiliser `min-height` ;
  - `overflow-wrap: anywhere` sur les références, les e-mails et les URL.
- **Reflow sans défilement horizontal**, à 320 px CSS, soit un zoom de 400 % sur un écran de 1280 px (WCAG 1.4.10).
  - Au-delà de 200 % de zoom, le survol bascule de lui-même sur la mise en page linéaire, grâce aux media queries mobiles existantes.
  - Les éléments fixes (barre du haut, rail, bandeau d'alerte) se replient pour ne pas cacher le contenu.
- **Back-office :** vérifier le shell (barre latérale en tiroir) et les tiroirs à 400 %.

### F41 : clavier seul

- **Navigation de base :**
  - un lien « Aller au contenu » côté citoyen et côté back-office ;
  - un ordre de tabulation logique ;
  - aucun piège à clavier ;
  - un focus visible partout, y compris sur le verre : anneau double, clair et sombre.
- **Défilement du survol :** vérifier que les flèches, Espace et Page suivante font défiler, et que le focus sur un élément y fait défiler la page.
- **Raccourcis :**
  - `?` ouvre une aide qui les liste ;
  - `/` va à la recherche, Échap ferme, ⌘K ouvre la palette du back-office ;
  - aucun raccourci d'une seule lettre n'est actif quand on écrit dans un champ.
- **Composants maison :**
  - les puces de choix sont dans un `fieldset` avec `legend`, et sont des boutons `aria-pressed` ou des boutons radio ;
  - les menus, tiroirs et modales posent un focus initial, gardent le focus à l'intérieur, puis le rendent à l'élément d'origine.
- **Cinématique :** elle ne capture pas le clavier, et le formulaire du sas est atteignable tout de suite.

### F42 : formulaires et composants

Chaque formulaire passe par les primitives du PLAN-00 (F6).

| Formulaire | Plan |
|---|---|
| Connexion (sas), inscription, profil, mot de passe, suppression du compte | 01 |
| Signalement, contact, démarche dynamique, réponse à une demande | 03 |
| Prise de rendez-vous | 05 |
| Recherche | 02 |
| Préférences d'affichage | 08 |
| Accueil guidé | 09 |
| Back-office : tous les tiroirs, modales et filtres | 01 à 10 |

**Règles à vérifier sur chaque formulaire :**
- un libellé visible, relié au champ (`for` et `id`), jamais remplacé par un placeholder ;
- l'aide et l'erreur reliées au champ par `aria-describedby`, et `aria-invalid` quand le champ est en erreur ;
- la mention « obligatoire » écrite en texte ;
- après un envoi, un résumé des erreurs qui prend le focus et contient un lien vers chaque champ ;
- des messages d'erreur qui disent **comment corriger**, et pas seulement « invalide » ;
- les erreurs du serveur (`details.fieldErrors`) affichées sur le bon champ ;
- `autocomplete` renseigné : `email`, `given-name`, `family-name`, `tel`, `street-address`, `new-password`, `current-password` ;
- des types adaptés (`email`, `tel`, `date`) ;
- les groupes de champs dans un `fieldset` avec `legend` ;
- les boutons désactivés accompagnés de leur raison, et pas seulement grisés.

### F43 : daltonisme

- **La couleur ne porte jamais l'information seule :**
  - statuts : icône et texte ; c'est déjà le cas des pastilles du back-office, à généraliser au composant citoyen `Pill` ;
  - jauges : valeur en chiffres ;
  - graphiques : légende, plus des motifs en mode `safe` ;
  - repères de carte (PLAN-07) : forme et icône ;
  - erreurs : icône et texte ;
  - liens : soulignés.
- **Mode `safe` :** remplace les couples rouge/vert par la palette bleu/orange déjà validée pour les graphiques du back-office (`--series-*`).
- **Vérification :** Chrome DevTools, Rendering, Emulate vision deficiencies, pour les quatre types de daltonisme et l'affichage en niveaux de gris.

### D20 : vue d'ensemble et preuve

- **Page « Déclaration d'accessibilité »** à `/ville/accessibilite`, liée depuis le pied de page et le sas :
  - niveau visé ;
  - fonctions d'adaptation disponibles ;
  - limites connues, comme la 3D ;
  - contact pour signaler un problème, via le formulaire de contact du PLAN-03 prérempli.
- **« Affichage simple »** donne accès à toutes les fonctions : c'est la réponse directe à « sans isoler ces utilisateurs dans un parcours incomplet ».
- **Bonus optionnel :** la dictée vocale dans les champs longs (signalement, contact, réponse), grâce au service `speech-to-text/` déjà présent (`hooks/useRealtimeTranscription.ts`). Elle aide les personnes qui ne peuvent pas taper.

## 6. Outils de vérification

- **Pendant le développement :**
  - `src/dev/axe.ts` est chargé seulement si `import.meta.env.DEV` est vrai, avec la dépendance de dev `axe-core` ;
  - `axe.run()` s'exécute après chaque navigation et liste les violations dans la console.
- **Protocole manuel, à refaire à la fin de chaque plan :**
  - parcours au clavier seul ;
  - VoiceOver sur macOS, ou NVDA sur Windows ;
  - zoom navigateur à 200 % puis à 400 % ;
  - panneau d'affichage : contraste élevé, texte à 200 %, couleurs sûres ;
  - émulation des daltonismes ;
  - `prefers-reduced-motion` et `forced-colors`.
- **Suivi :** créer `project-plan/annexes/a11y-checklist.md`, avec une ligne par écran et une colonne par critère, cochée à chaque plan.

## 7. Étapes

1. [ ] Préférences : modèle, attributs sur `<html>`, `a11y.css`, panneau ; synchronisation `localStorage` et `/api/me`.
2. [ ] « Affichage simple » : la scène n'est pas montée et la mise en page devient linéaire ; activation automatique sans WebGL.
3. [ ] Conversion en `rem` et corrections du reflow (F24, F44).
4. [ ] Structure, liens d'évitement, focus et annonces vocales (F21, F41).
5. [ ] Thème contraste élevé et vérification des contrastes (F23).
6. [ ] Mode `safe` et icônes sur les statuts côté citoyen (F43).
7. [ ] Audit des formulaires (F42), au fil des plans, puis passe finale.
8. [ ] `axe` en développement, déclaration d'accessibilité (D20), passe finale avec le protocole complet.

## 8. Critères d'acceptation (démo devant le jury)

1. **F21 :** avec VoiceOver et sans regarder l'écran, on s'inscrit, on signale un problème, puis on suit sa demande.
2. **F23 :** en mode contraste élevé, tous les textes atteignent au moins 7:1 et les panneaux deviennent opaques.
3. **F24 :** avec le texte à 200 % depuis le panneau, rien ne se chevauche et aucun texte n'est coupé.
4. **F41 :** le parcours connexion, démarche, rendez-vous puis déconnexion se fait au clavier seul, avec un focus toujours visible.
5. **F42 :** quand on envoie un formulaire incomplet, le résumé des erreurs est annoncé, et chaque champ en erreur est décrit et atteignable.
6. **F43 :** en niveaux de gris comme en deutéranopie, les statuts, alertes, graphiques et repères de carte restent distinguables.
7. **F44 :** avec un zoom navigateur à 400 %, il n'y a aucun défilement horizontal et toutes les fonctions restent disponibles.
8. **D20 :** « Affichage simple » donne accès à toutes les fonctions, et la déclaration d'accessibilité est publiée.

## 9. Version minimale

- Le panneau de préférences avec contraste élevé, taille du texte et « Affichage simple ».
- Les liens d'évitement, le focus visible et le focus au changement de page.
- Les primitives de formulaire, déjà prévues au PLAN-00, appliquées à la connexion, à l'inscription, au signalement et au contact.
- Les icônes sur les statuts.
- La déclaration d'accessibilité.

La conversion en `rem` peut se limiter, dans un premier temps, aux pages citoyennes.
