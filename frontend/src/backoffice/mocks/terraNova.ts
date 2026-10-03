import type { TerraNovaFeed, TerraNovaRequest } from './types'

// Snapshot of the official Terra Nova API (wave 5), as returned by GET /api/terra-nova/requests.
const r = (
  id: number,
  request_code: string,
  requester_name: string,
  requester_type: string,
  difficulty: TerraNovaRequest['difficulty'],
  xp_total: number,
  group_name: string,
  wave_number: number | null,
  message_public: string,
  is_ai_request = false,
): TerraNovaRequest => ({ id, request_code, requester_name, requester_type, difficulty, xp_total, group_name, wave_number, message_public, is_ai_request })

const SOCLE = 'Socle'
const G1 = '1 — Premiers habitants'
const G2 = '2 — Informer et servir'

export const TERRA_NOVA_FEED: TerraNovaFeed = {
  session: {
    status: 'active',
    current_wave: 5,
    elapsed_minutes: 407,
    visible_requests_count: 36,
    next_wave_number: 6,
    minutes_until_next_wave: 13,
  },
  requests: [
    r(1, 'D01', 'Haut Conseil de la Ville', 'Institution', 'Facile', 250, SOCLE, null, 'Permettre à un nouvel habitant de créer simplement un compte afin d’utiliser les services numériques de la ville et de retrouver son espace personnel.'),
    r(2, 'D03', 'Direction des Services Municipaux', 'Institution', 'Facile', 250, SOCLE, null, 'Les citoyens doivent pouvoir se connecter à un espace personnel clairement identifié et y retrouver les informations et démarches qui les concernent.'),
    r(3, 'D04', 'Service des Relations Citoyennes', 'Institution', 'Facile', 250, SOCLE, null, 'Prévoir un moyen simple de transmettre un message aux services municipaux et de confirmer que la demande a bien été envoyée.'),
    r(4, 'D05', 'Mairie de Nova Terra', 'Institution', 'Facile', 250, SOCLE, null, 'Présenter les principaux services de Nova Terra de manière claire et permettre d’accéder facilement aux informations utiles.'),
    r(5, 'D06', 'Mairie de Nova Terra', 'Institution', 'Facile', 250, SOCLE, null, 'Les habitants doivent pouvoir retrouver les annonces municipales et informations pratiques depuis la plateforme.'),
    r(6, 'D07', 'Mairie de Nova Terra', 'Institution', 'Moyenne', 500, SOCLE, null, 'La page d’accueil doit hiérarchiser les informations essentielles et donner un accès évident aux principaux services.'),
    r(7, 'D08', 'Direction des Services Municipaux', 'Institution', 'Moyenne', 500, SOCLE, null, 'Distinguer clairement citoyens, agents municipaux et administrateurs afin d’adapter les outils de chacun.'),
    r(8, 'D09', 'Direction des Services Municipaux', 'Institution', 'Moyenne', 500, SOCLE, null, 'Un citoyen ne doit pas atteindre les outils réservés aux agents ; les fonctions sensibles restent limitées aux profils autorisés.'),
    r(9, 'D19', 'Direction du Numérique', 'Institution', 'Difficile', 750, SOCLE, null, 'Les agents doivent accéder à une interface distincte et y consulter les informations transmises par l’API Nova Terra.'),
    r(10, 'F22', 'Centre technique municipal', 'Institution', 'Facile', 250, SOCLE, null, 'Retrouver les demandes des habitants dans une vue claire, identifier leur état et celles qui nécessitent encore une action.'),
    r(11, 'F21', 'Marc Delcourt — Citoyen', 'Citoyen', 'Moyenne', 520, G1, 1, 'J’utilise un lecteur d’écran et je n’arrive pas à comprendre certains boutons, formulaires ou l’organisation du contenu.'),
    r(12, 'F23', 'Jean Morel — Citoyen', 'Citoyen', 'Moyenne', 520, G1, 1, 'Ma vue baisse : les informations importantes manquent parfois de contraste.'),
    r(13, 'F24', 'Sophie Nguyen — Citoyenne', 'Citoyen', 'Facile', 260, G1, 1, 'Pouvoir augmenter la taille des caractères sans que les pages deviennent inutilisables.'),
    r(14, 'D11', 'Pauline R. — Citoyenne', 'Citoyen', 'Moyenne', 540, G1, 2, 'Retrouver au même endroit mes demandes, leur état actuel et les principales étapes déjà réalisées.'),
    r(15, 'D12', 'Service d’Accueil des Nouveaux Arrivants', 'Institution', 'Moyenne', 540, G1, 2, 'À la première connexion, comprendre comment compléter son profil, trouver un service et commencer une démarche.'),
    r(16, 'D14', 'Amina Rahal — Citoyenne', 'Citoyen', 'Moyenne', 540, G1, 2, 'Pouvoir choisir une autre langue pour comprendre l’interface et effectuer mes démarches.'),
    r(17, 'D15', 'Citoyen', 'Citoyen', 'Facile', 270, G1, 2, 'Disposer d’un repère simple pour comprendre mon emplacement et revenir aux niveaux précédents.'),
    r(18, 'D16', 'Citoyenne', 'Citoyen', 'Facile', 270, G1, 2, 'Obtenir une confirmation claire immédiatement après l’envoi d’une demande.'),
    r(19, 'D17', 'Service Relation Usagers', 'Institution', 'Facile', 270, G1, 2, 'Savoir immédiatement combien de demandes attendent encore une prise en charge.'),
    r(20, 'F25', 'Lucas Meyer — Citoyen', 'Citoyen', 'Moyenne', 540, G1, 2, 'Un lampadaire est cassé dans ma rue : pouvoir signaler ce type de problème en indiquant ce qui s’est passé et où.'),
    r(21, 'F26', 'Citoyenne anonyme', 'Citoyen', 'Facile', 270, G1, 2, 'Un historique dans mon espace personnel pour retrouver mes demandes précédentes.'),
    r(22, 'F27', 'Service d’Accueil', 'Institution', 'Moyenne', 540, G1, 2, 'Les contenus essentiels des services et démarches doivent être proposés dans plusieurs langues.'),
    r(23, 'F28', 'Mairie de Nova Terra', 'Institution', 'Facile', 270, G1, 2, 'Mettre en avant les services prioritaires ou les plus utilisés.'),
    r(24, 'D18', 'Haut Conseil de la Ville', 'Institution', 'Difficile', 840, G2, 3, 'Diffuser rapidement un message général à tous les habitants, visible au bon moment.'),
    r(25, 'F29', 'Centre de surveillance environnementale', 'Alerte', 'Difficile', 840, G2, 3, 'Montée inhabituelle du niveau de l’eau dans le quartier sud : les habitants doivent être informés rapidement.'),
    r(26, 'F30', 'Service Communication', 'Institution', 'Moyenne', 560, G2, 3, 'Les habitants souhaitent être prévenus lorsqu’une annonce importante est publiée.'),
    r(27, 'F31', 'Agence sanitaire de Nova Terra', 'Alerte', 'Difficile', 840, G2, 3, 'Vague de chaleur extrême : informer rapidement les personnes vulnérables avec des recommandations adaptées.', true),
    r(28, 'F32', 'Citoyenne', 'Citoyen', 'Facile', 280, G2, 3, 'Je cherche les services de santé mais je ne les trouve pas facilement.'),
    r(29, 'F33', 'Service des Usagers', 'Institution', 'Facile', 290, G2, 4, 'Les citoyens doivent pouvoir supprimer leur compte s’ils le souhaitent.'),
    r(30, 'F34', 'Direction du Numérique', 'Institution', 'Moyenne', 580, G2, 4, 'Les agents doivent pouvoir administrer les comptes citoyens.'),
    r(31, 'F35', 'Nouveau citoyen', 'Citoyen', 'Facile', 290, G2, 4, 'Quelques indications au bon moment m’aideraient à effectuer mes premières actions.'),
    r(32, 'F36', 'Service Mobilité', 'Institution', 'Moyenne', 580, G2, 4, 'Consulter les horaires et infos des transports municipaux sans parcourir plusieurs écrans.'),
    r(33, 'F37', 'Centre de cybersécurité', 'Alerte sécurité', 'Difficile', 900, G2, 5, 'Nombre inhabituel de tentatives de connexion sur plusieurs comptes citoyens : la protection doit être perceptible.'),
    r(34, 'F38', 'Citoyen', 'Citoyen', 'Moyenne', 600, G2, 5, 'Savoir qu’un service est indisponible avant de commencer une démarche, et quand revenir.'),
    r(35, 'F39', 'Service Administration', 'Institution', 'Moyenne', 600, G2, 5, 'Prendre rendez-vous avec un agent sans ambiguïté sur le créneau choisi.'),
    r(36, 'F40', 'Citoyenne', 'Citoyen', 'Facile', 300, G2, 5, 'Recevoir un rappel avant mon rendez-vous.'),
  ],
}
