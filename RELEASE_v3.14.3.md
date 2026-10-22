# AniPic 3.14.3 — Synchronisation SPA : ententes longues conservées

Une réponse d’entente enfant dépassant 100 caractères pouvait faire échouer la synchronisation de tous les animaux avec l’erreur `animals[32].compatibility.enfant / too_big`. Cette limite locale inadaptée au texte du refuge est supprimée.

- Aucune limite de longueur propre aux ententes enfant, chat ou chien : les conseils et conditions sont conservés intégralement.
- Suppression des coupures silencieuses à 240/500 caractères dans l’extraction, la normalisation et la restitution des ententes. La description d’entente source est également conservée.
- Les protections de taille globale du flux, de pagination, de périmètre du refuge et d’archivage restent actives.

Deux tests de régression reproduisent l’erreur exacte sur le 33e animal d’un inventaire simulé de 75 animaux, puis vérifient une synchronisation complète, les textes de plus de 15 000 caractères en base et dans l’API, les photos conservées et l’absence d’archivage lors d’un inventaire incomplet.

Mettre à jour **la stack existante**, en conservant les volumes et les chemins NAS, puis relancer la synchronisation. Aucune migration destructive ou suppression de données n’est nécessaire. L’APK native reste en 3.14.0 : ce correctif serveur s’applique aussi à Android sans réinstallation.

Cette version conserve les nouveautés et corrections de [3.14.2](RELEASE_v3.14.2.md). Voir les contrôles réellement exécutés dans [VALIDATION.md](VALIDATION.md).
