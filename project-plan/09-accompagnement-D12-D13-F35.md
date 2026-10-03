# PLAN-09 : accompagnement des nouveaux habitants

> **Réfs :** D12 · D13 · F35. **XP :** 1 140.
> **Dépend de :**
> - PLAN-01 (profil) ;
> - PLAN-02 (trouver un service) ;
> - PLAN-03 (commencer une démarche) ;
> - PLAN-08 (règles d'accessibilité des bulles et des définitions).
>
> **Effort :** ≈ 4 h.

## 1. Pourquoi ces demandes vont ensemble

Les trois demandes visent le même public, le nouvel arrivant ou l'habitant peu à l'aise avec la plateforme, au même moment : ses premières actions.

| Réf | Demandeur | Besoin | Preuve que c'est fait |
|---|---|---|---|
| D12 | Service d'Accueil des Nouveaux Arrivants | À la 1ʳᵉ connexion, comprendre comment compléter son profil, trouver un service et commencer une démarche | Accueil guidé en 3 étapes, qu'on peut reprendre plus tard |
| F35 | Nouveau citoyen | Des indications au bon moment, sans long guide | Bulles d'aide contextuelles, affichées une seule fois et refermables |
| D13 | Plusieurs citoyens | Comprendre les mots difficiles | Vocabulaire simplifié, définitions affichées sur place et lexique |

Ce qui les relie :
- l'accueil guidé (D12) déclenche les premières bulles d'aide (F35) ;
- bulles et définitions (D13) partagent le même composant de bulle accessible ;
- tous les trois reposent sur les préférences de l'utilisateur (`User.preferences`).

## 2. Existant

**Backend :**
- `User.onboarding_completed` et `POST /api/me/onboarding/complete` existent.
- `preferences` est un champ JSON libre.
- Le seed contient la démarche « Inscription nouvel habitant » (service « Accueil des nouveaux arrivants »), avec un formulaire : date d'arrivée, taille du foyer.

**Front :**
- Rien n'existe encore pour ces trois demandes.
- L'espace citoyen emploie beaucoup de vocabulaire de science-fiction : « sas », « Demander l'entrée », « code d'accès », « couloir d'entrée », « Haut Conseil », « dôme », « liaison ».
- Côté back-office, les statuts techniques sont déjà traduits (`lib/labels.ts`).

## 3. Backend

### Lexique (D13)

```prisma
// D13: plain-language definitions of the words used by the platform
model GlossaryTerm {
  id         Int      @id @default(autoincrement())
  updated_at DateTime @updatedAt
  slug       String   @unique
  term       String
  definition String   @db.Text   // langage simple, 2 phrases au plus
  example    String?  @db.Text
  aliases    String?             // variantes, séparées par des virgules, pour le repérage automatique
  category   String?
  is_active  Boolean  @default(true)
}
```

**Endpoints :**
- `GET /api/glossary?q=` : public, tri alphabétique.
- `GET /api/glossary/:slug` : public.
- `POST /api/glossary`, `PATCH /api/glossary/:id`, `DELETE /api/glossary/:id` : réservés aux admins, et audités (PLAN-10).

**Seed :** environ 25 termes. Par exemple : démarche, justificatif, justificatif de domicile, état civil, copie intégrale, extrait d'acte, signalement, référence de demande, prise en charge, demande clôturée, créneau, rappel, interruption de service, alternative, quartier, personne vulnérable, alerte ciblée, notification, pièce jointe, délai estimé, agent municipal, Haut Conseil.

### Bulles d'aide (F35)

Pas de nouvelle table. L'état est stocké dans `preferences.tips` : `{ enabled: boolean, dismissed: string[] }`.

## 4. Front citoyen

### 4.1 Accueil guidé (D12), route `/ville/bienvenue`

**Ouverture :**
- automatiquement après la première connexion, quand `onboarding_completed === false` ;
- à tout moment depuis « Mon espace ».

**Les 3 étapes :**

1. **Compléter mon profil.** Saisie du quartier et du téléphone (`PATCH /api/me`). Ensuite :
   - une case « personne vulnérable », avec une explication claire : « Vous serez prévenu·e en priorité en cas d'alerte sanitaire » ;
   - un lien vers les préférences d'affichage (PLAN-08).
2. **Trouver un service.**
   - Les catégories, sous forme de grandes tuiles, et la recherche (PLAN-02).
   - Une section « Les plus demandés par les nouveaux arrivants », alimentée par les services mis en avant.
3. **Commencer une démarche.**
   - Proposition directe : « Déclarer mon arrivée à Terra Nova », qui ouvre `/ville/demarches/<slug de la démarche d'inscription>` (PLAN-03).
   - Ou « Plus tard ».

**Fonctionnement :**
- Un indicateur montre la progression (« Étape 2 sur 3 »).
- Chaque étape peut être passée.
- On peut revenir en arrière sans perdre ce qui a été saisi.
- À la fin, l'application appelle `POST /api/me/onboarding/complete` et affiche « Vous êtes prêt·e ».
- Tant que les 3 étapes ne sont pas faites, « Mon espace » affiche une carte « Bien démarrer : 2/3 ». La progression est calculée à partir des données : profil rempli, au moins une demande créée.

### 4.2 Indications au bon moment (F35)

**Composant `features/help/Tip` et hook `useTip(id, condition)` :**
- une seule bulle à la fois ;
- ancrée à l'élément concerné ;
- un texte d'une phrase ;
- un bouton « Compris ».

**Règles d'accessibilité :**
- la bulle n'est jamais une fenêtre modale ;
- elle n'apparaît jamais au seul survol de la souris ;
- elle ne prend pas le focus : elle est annoncée par une région `aria-live` discrète ;
- elle se place dans l'ordre de tabulation, juste après l'élément qu'elle décrit ;
- la touche Échap la ferme.

**Déclencheurs initiaux :**

| id | Où et quand | Message |
|---|---|---|
| `report-one-sentence` | Première ouverture du formulaire de signalement | « Une phrase suffit : NOVA propose la catégorie et le quartier, vous pourrez corriger. » |
| `track-request` | Après la première confirmation d'envoi | « Retrouvez cette demande et son avancement dans Mon espace. » |
| `search-words` | Première visite du catalogue | « Tapez un mot simple (« médecin », « poubelle ») pour trouver le bon service. » |
| `reminder-choice` | Étape 4 de la prise de rendez-vous | « Choisissez quand être prévenu·e avant votre rendez-vous. » |
| `emergency-button` | Première arrivée en ville | « En cas d'urgence, ce bouton affiche les numéros et les hôpitaux ouverts. » |
| `display-settings` | Première arrivée en ville, après la précédente | « Texte trop petit ou trop peu contrasté ? Réglez l'affichage ici. » |

**Mémoire :**
- les bulles fermées sont enregistrées dans `preferences.tips.dismissed` (serveur) et dans `localStorage` (avant connexion) ;
- le profil propose « Réactiver les astuces » et « Ne plus afficher d'astuces ».

### 4.3 Mots compréhensibles (D13)

**Relecture du vocabulaire.** Les boutons et les libellés emploient des mots courants. L'univers de science-fiction reste dans le décor : titres d'ambiance, radio, télémétrie.

| Avant | Après |
|---|---|
| Demander l'entrée | Se connecter |
| Code d'accès | Mot de passe |
| Contrôle d'accès de Terra Nova | Connexion à Terra Nova |
| Envoyer au Haut Conseil | Envoyer à la mairie |
| Haut Conseil (1ʳᵉ mention) | Mairie (Haut Conseil) |
| Statuts techniques | Toujours via `requestStatus.ts` (PLAN-03) |

**Composant `<Term slug="justificatif">justificatif</Term>` :**
- le mot est souligné en pointillé, avec une petite icône ;
- un clic ou la touche Entrée ouvre une définition courte, avec un exemple et un lien « Voir le lexique » ;
- c'est une bulle accessible : `aria-expanded`, fermeture par Échap, retour du focus sur le mot.

**Lexique, route `/ville/aide/lexique` :**
- recherche et index de A à Z ;
- chaque terme affiche sa définition et un exemple ;
- liens depuis le pied de page, la barre du haut (« Aide ») et la recherche (F32).

**Option : repérage automatique.** Dans les descriptions de services et de démarches, la première occurrence de chaque terme du lexique (ou de l'un de ses alias) est enveloppée dans `<Term>`.

## 5. Back-office

- **Page `/admin/lexique`** (D13), dans le menu « Contenus › Lexique » :
  - liste et recherche ;
  - création et modification, avec un aperçu de la bulle ;
  - activation et désactivation des termes.
- **Agents :** lecture seule du lexique, pour utiliser les mêmes mots que les habitants dans leurs réponses.

## 6. Étapes

- [ ] Backend : `GlossaryTerm`, sa migration, ses endpoints et le seed des termes
- [ ] `src/api/glossary.ts` et la partie `preferences.tips` de `src/api/me.ts`
- [ ] `/ville/bienvenue`, la redirection après la première connexion et la carte « Bien démarrer »
- [ ] `Tip`, `useTip` et les 6 déclencheurs ; options dans le profil
- [ ] Relecture du vocabulaire (tableau ci-dessus) dans le sas, la ville et les formulaires
- [ ] `Term` et la page `/ville/aide/lexique`
- [ ] Back-office : page `/admin/lexique` et son entrée dans `nav.ts`

## 7. Critères d'acceptation

1. **D12.**
   - Un compte tout neuf est guidé en 3 étapes : en moins de 3 minutes, il a complété son profil, trouvé un service et commencé « Déclarer mon arrivée ».
   - S'il passe l'accueil, il le retrouve ensuite dans « Mon espace ».
2. **F35.**
   - Chaque bulle n'apparaît qu'une fois, au moment de l'action.
   - Elle se ferme au clavier et ne bloque rien.
   - On peut les réactiver ou les désactiver depuis le profil.
3. **D13.**
   - Dans une démarche, les mots difficiles s'expliquent sur place en un clic.
   - Le lexique se consulte et se recherche.
   - Plus aucun libellé d'action ne repose sur le jargon de l'univers.

## 8. Version minimale

À faire en premier :
- l'accueil guidé en 3 étapes ;
- la relecture du vocabulaire ;
- `Term` et le lexique, avec un lexique livré dans le seed ;
- 3 bulles : signalement, suivi, urgences.

Peut attendre : la page d'administration du lexique et le repérage automatique.
