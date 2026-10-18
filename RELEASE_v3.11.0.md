# AniPic 3.11.0 — Android, accueil et suivi des adoptions

APK Android reliée à `https://anipic.gaerisson.fr`, avec accès Adoptions, Photos, C8 et tous les autres outils par le menu Plus. Données, comptes et droits communs au site ; les mises à jour web ne demandent généralement pas de nouvelle APK. Association Android servie par AniPic, icônes et écran hors connexion sans cache des données de l’équipe.

Accueil plus compact : météo à côté de l’horloge, effectifs chiens/chats/NAC présents, nombre photographié, restant et progression des portraits locaux. Les références SPA seules ne comptent pas comme portraits réalisés par l’équipe. Le fil montre les photos et permet aux agents de répondre aux propositions d’adoption. L’indication technique du tri est retirée.

Confirmation d’adoption automatique après les absences fiables, ou demande à l’équipe puis confirmation après 24 h sans réponse et un nouvel inventaire fiable. Historique pour refuser, annuler ou rétablir une décision. Les refus survivent aux synchronisations suivantes ; un retour de l’animal corrige les déductions. Aucun double comptage ni suppression de photo. Réglages existants conservés : choisir le mode dans Synchronisation puis enregistrer.

Validation : 261 tests applicatifs réussis, builds frontend/vidéo, npm ci propre Node 24, variantes Compose et workflows contrôlés. APK release et debug compilées, lint release sans erreur, signature et manifeste vérifiés. Sources Android et procédure incluses ; clé de signature conservée localement hors du projet.

Pas d’essai sur un vrai Android, de lecture C8 sur téléphone, de build Docker local ni de déploiement distant. Voir [Android](docs/ANDROID.md) et [validation](VALIDATION.md). Volumes existants et schéma SQLite conservés.

© Gaerisson · AniPic
