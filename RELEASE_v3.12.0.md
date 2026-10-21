# AniPic 3.12.0 — L’équipe et le refuge, partout

Le planning des bénévoles, le fil mobile et les outils de rédaction rejoignent AniPic. L’administrateur peut activer les modules dont son refuge a besoin et proposer des affiches sans compte, à partir des seuls portraits publics ou SPA.

- **Android** : accueil utile, récapitulatif sur sept jours, onglets Fil et Planning, notifications choisies par catégorie et par appareil, connexions mémorisées et révocables. Une APK 3.12.0 signée est fournie dans le projet.
- **Mises à jour** : détection des nouvelles versions web et APK, bouton de mise à jour, téléchargement vérifié par SHA-256 puis comparaison de la signature avec l’application installée. L’installateur Android conserve sa confirmation système ; aucune installation silencieuse. Installer cette première APK avec ce mécanisme depuis `/android`.
- **Téléchargement Android** : page revue, aperçu mobile, fonctions et étapes, QR, version et empreintes ; bouton depuis l’accueil web et mobile.
- **Planning** : créneaux, répétition hebdomadaire, capacités, liste d’attente, disponibilités, synthèse des personnes présentes et CSV ; modifications réservées aux agents/administrateurs.
- **TV** : capture réelle du lecteur à la demande ou toutes les 45 s pendant un suivi visuel, réglages individuels, orientation, espèces, durée, QR et statistiques. État du réseau, temps d’ouverture, reconnexions et récupération après coupure ; le dernier programme reste affiché.
- **Textes** : présentation sans IA ou avec Token Harbor, propositions de relecture et repérage des fiches sans photo locale. Brouillons privés, aucune modification automatique sur la SPA.
- **Confidentialité** : pages légales et conditions par installation, coordonnées à compléter plus tard dans l’administration, statistiques facultatives bloquées avant consentement, retrait simple, reçus sans IP et durées réglables. L’attribution de l’auteur reste Gaerisson.
- **Licence** : code original sous GPLv3 avec exception de liaison limitée à Remotion, copyright Gaerisson et notices distinctes pour les composants et médias tiers.
- **Interface** : fil en une colonne, fenêtres et formulaires mobiles ajustés, loader SPA corrigé pour les images en cache, disparition du texte d’accueil demandé.

Migration SQLite additive (schéma 22). Les volumes Compose, photos, sauvegardes et configurations sont conservés. Les dépendances sont gérées par npm avec lockfile cohérent.

Les contrôles effectivement exécutés et les limites de validation figurent dans [VALIDATION.md](VALIDATION.md). Les coordonnées légales et contrats des prestataires restent à compléter par chaque exploitant ; ce code ne constitue pas une certification juridique. Aucune publication GitHub/GHCR réalisée dans cette intervention.
