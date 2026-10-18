# AniPic 3.3 — Photos SPA, studio et installation

Les photos du site SPA restent utilisables quand aucun portrait local n’est disponible : attribution, planning, affiches de box, publications, bannières et montage vidéo. Une image source commune alimente les différentes tailles du cache. Le studio attend le décodage des photos avant de proposer la lecture ; une erreur reste visible et peut être relancée. La TV conserve son programme précédent pendant la préparation de la nouvelle sélection.

Le bilan annuel sépare le portrait principal des bandes animées, conserve le cadrage choisi et dévoile le logo SPA en couleur. Message de fin et sous-texte personnalisables, suggestions « Bonne année… », bandes et statistiques désactivables. Les MP4 déjà exportés gardent leur ancien rendu ; les relancer pour bénéficier du nouveau montage.

## Photos, albums et navigation

- Albums imbriqués : déplacement par glisser-déposer ou liste, renommage des dossiers et médias, légendes, photos et vidéos privées, corbeille et restauration.
- Zones d’import avec glisser-déposer, aperçu des fichiers et progression. Zoom et déplacement dans la photo, informations du fichier. Les doubles clics sur les flèches restent des changements de photo.
- Liens de navigation utilisables au clic molette. Réponses de l’assistant mises en forme avec état de réflexion.
- Archives regroupées par espèce puis année ; une archive sans statut d’adoption explicite n’est plus présentée à l’adoption. Ententes séparées même avec des libellés concaténés ou des points-virgules.
- Lecteur C8 en plein écran avec commandes qui s’effacent ; filtre et halo Morée d’après le nom du fichier ou dossier.
- Suppression du modèle Liquid glass dans Visuels & bannières. Logo SPA, signature, titres des fenêtres et boutons réalignés. Le GitHub de l’auteur reste celui de Gaerisson.

## Nettoyage et identité visuelle

Logo AniPic redessiné : deux cadres conservés, quatre doigts distincts et coussinet séparé. Une source vectorielle commune régénère les SVG, le favicon et les PNG avec `npm run brand:build`.

18 fichiers obsolètes retirés, dont les anciennes compositions GPIC, captures et doublons. Les commandes de présentation story/trailer utilisent le montage actuel. Les anciennes notes et vérifications sont rangées dans `docs/history` avec leurs liens corrigés ; README et validation courante restent à la racine. Le build vidéo nettoie son seul dossier généré pour ne plus conserver d’anciens assets. Documentation et rendus de test exclus du contexte Docker.

## Administration et déploiement

Journal des opérations, traitements et erreurs HTTP, réservé à l’administration. Les erreurs excluent corps de requête, cookies et paramètres OAuth. Diagnostic des dossiers photos, sauvegardes, C8 et Import dans Stockage.

Le retour Canva récupère sa session uniquement sur le callback prévu, via un cookie temporaire et limité à ce chemin. Le PIN reste actif ; session, utilisateur, réseau éventuel, `state`, PKCE et expiration restent vérifiés.

Lockfile régénéré par npm sous Node.js 24, dossiers Docker créés de façon idempotente, CI sur PR/push main/tags, compilations frontend et vidéo, image complète et test de démarrage/rendu. Script de préparation NAS côté hôte : validation NFS/SMB, droits UID/GID, création des dossiers et marqueurs, refus du disque local lorsque le NAS manque. Volumes et montages existants conservés ; migration additive du schéma 14 vers 15.

[Installation](../DEPLOIEMENT.md) · [Procédure avant release et dépannage](../CONTROLES_RELEASE.md) · [Contrôles réellement exécutés](../../VALIDATION.md)

Le build d’image et le déploiement sur votre NAS/Portainer doivent encore être exécutés sur un moteur Docker. La validation syntaxique Compose et les simulations de panne ne remplacent pas cet essai.

© 2026 [Gaerisson](https://github.com/Gaerisson/). Projet vibecodé avec Codex, assistant d’OpenAI. La SPA conserve ses droits sur ses marques, son logo et ses contenus.
