# AniPic 3.4.0 — 17 octobre 2026

- Affiches de box : sélection « Site SPA » / « Locale », génération et aperçu avec indicateur d’activité, exports suspendus pendant l’actualisation de l’aperçu.
- Canva : l’envoi ouvre un onglet d’attente puis le design dès que son import est terminé ; lien manuel disponible si le navigateur bloque les fenêtres. Session, PIN, state et PKCE restent vérifiés.
- IA : messages de réponse vide, limite de génération, refus et réponse illisible visibles dans l’interface. Les exceptions internes restent masquées.
- Assistant : liens rapides réalignés, bouton chatbot avec le même avatar, conversation suivie, contexte des fiches publiques et des outils, liens vers les animaux. Aucun changement de fiche automatique.
- TV, fonds animés et bilan : mouvement web interpolé à la fréquence de l’écran, palettes saisonnières, neige / citrouilles / patounes et autres particules, horaires en grille, trois nouvelles animations du logo. Les options sont aussi utilisées à l’export vidéo.
- Bannières : ambiances saisonnières, choix des effets et de leur densité, sous-titre et couleur du texte.
- Équipe : avatars personnels depuis le compte et date/heure de dernière connexion. Les comptes existants commencent sans date inventée.
- Journal : heures et bilans de synchronisation avec arrivées, archivages, modifications réelles et fiches inchangées. Statistiques locales séparées des fiches ayant une référence SPA.
- C8 : miniatures générées par FFmpeg en cache, repli pour les vidéos courtes, cartes de même structure avec ou sans badge Morée.
- Albums : couvertures issues des sous-dossiers, sans exposer les descendants privés aux visiteurs.
- Photos d’animaux, y compris archivées : corbeille restaurable. Compression NAS optionnelle dans **Stockage**, avec estimation, confirmation de perte de qualité et sauvegarde complète vérifiée avant tout remplacement.
- Audio/vidéo : limite de 512 Mo par fichier par défaut, réglable via `MAX_MEDIA_MB` jusqu’à 4 096 Mo. La limite photo `MAX_UPLOAD_MB` reste indépendante.

## Mise à jour

Utiliser le même projet Compose et les mêmes volumes. Depuis Git/Portainer : `compose.yml`, avec les éventuels `compose.c8.yml` et `compose.import.yml`, et téléchargement forcé de l’image désactivé. L’image locale est `anipic:3.4.0` ; le dépôt ne publie pas d’image Docker Hub. Aucun `down -v` ni changement des montages n’est requis.

SQLite migre automatiquement de 15 vers 16 : métadonnées de compte, corbeille et historique de compression. L’opération de compression est désactivée tant que l’administrateur ne l’a pas explicitement lancée. Elle ne s’exécute pas pendant une migration ou une mise à jour.

[Gestion des archives et restauration](../ARCHIVES.md) · [Déploiement](../DEPLOIEMENT.md) · [Contrôles réellement exécutés et limites](../../VALIDATION.md)

© 2026 Gaerisson. Le logo et l’identité de La SPA conservent leurs mentions et règles d’utilisation.
