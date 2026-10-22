# AniPic 3.13.0 — Créations, interface et application personnalisable

Cette version améliore la lisibilité des outils, les créations du refuge et le suivi sur téléphone, tout en conservant les données et montages Docker existants.

- Interface : pied de page compact, page À propos enrichie, illustration Android réduite, menus regroupés, accès commun aux créations et espacements corrigés dans les outils, la gazette, le compte et la timeline. L’import GPIC passe dans les fonctions avancées.
- Bannières : cinq nouvelles compositions, animaux à gauche et à droite avec détourage local automatique, photo du refuge en fond, textes et bandeau de contact, saisons, particules, placement par glisser et template mémorisé dans le navigateur. Les exports attendent les images et transparences nécessaires.
- Rédaction : Token Harbor par défaut lorsqu’il est configuré, texte structuré avec émojis utiles et faits vérifiés, aperçu lisible et corrections soulignées / barrées directement dans le texte.
- Historique SPA : changements regroupés par animal et relevé, comparaison avant / après, valeurs traduites et consultation récente en premier. Le contrat historique ascendant de l’API reste disponible.
- Prénoms : plus de 1 500 propositions thématiques et actualisation nationale nocturne. Le dernier catalogue complet reste utilisable sans attendre une nouvelle lecture ; les noms des animaux partis peuvent être réutilisés.
- Android : thème SPA clair au premier usage, boutons Refuge / Fil / Photos / Albums / C8 personnalisables, widgets réordonnables et didacticiel guidé. Les notifications peuvent être réassociées après reconnexion du même compte, avec diagnostic et bouton de test.
- TV : aperçu par captures réglable jusqu’à 2 secondes, expiration automatique du suivi visuel, réception rapide des commandes et retrait d’un appareil plus accessible. Les captures et réglages restent protégés.
- Statistiques : complément d’adoptions ou total annuel manuel, réservé aux agents / administrateurs et partagé par les bilans vidéo et TV, sans changer les faits SPA.
- Équipe : sondages programmables sur les présences, collectes ou prénoms, résultats et bouton de partage WhatsApp. L’envoi dans une communauté reste effectué par l’utilisateur.
- Fiabilité : miniatures de 160 px acceptées, photos supprimées écartées de la détection de doublons, réimport explicite restaurable sans perdre la confidentialité, confirmation d’adoption conservant sa date et sa place d’origine dans le fil.

## Mise à jour

Conserver la même stack et tous les volumes SQLite, photos, cache, sauvegardes, C8 et Import. La migration SQLite 23 ajoute les tables nécessaires ; aucune réinitialisation des volumes n’est requise. Suivre le [guide Docker / Portainer](docs/DEPLOIEMENT.md).

L’APK 3.13.0, signée avec le même certificat, est fournie dans le projet et sur `/android`. Les mises à jour de l’interface passent principalement par le déploiement du site ; Android conserve sa confirmation système pour installer une nouvelle APK.

Voir la [validation exécutée et ses limites](VALIDATION.md), le [guide des créations et de l’application](docs/CREATIONS_ET_APPLICATION.md) et le [fonctionnement WhatsApp](docs/WHATSAPP.md).
