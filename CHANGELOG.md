# Journal des versions

## 3.5.4 — 17 octobre 2026

Originaux chargés progressivement dans les albums pour un zoom net, sans ouvrir leur accès public. Couleurs de texte TV indépendantes du thème de l’interface, y compris messages, statistiques et aperçu du bilan annuel. Ententes avec « oui/non » dans une phrase classées en orange. Guide des API SPA/AniPic avec exemples vérifiés. [Détail](RELEASE_v3.5.4.md).

## 3.5.3 — 17 octobre 2026

Autorisation PIN sans expiration côté AniPic, conservée après redémarrage. Les anciens accès encore valides sont prolongés sans redemander le code ; changer le PIN révoque toujours les accès précédents. [Détail](RELEASE_v3.5.3.md).

## 3.5.2 — 17 octobre 2026

Configuration TV ouverte aux agents SPA via une API dédiée, sans accès aux paramètres généraux. PIN mémorisé dans un cookie persistant de 30 jours, renouvelé lors des visites et de la diffusion, indépendant de la session de compte et révocable. [Détail](RELEASE_v3.5.2.md).

## 3.5.1 — 17 octobre 2026

Fenêtres claires opaques sur le voile sombre, verre lisible et textes secondaires suivant le thème. Prénoms filtrés sur les animaux présents et le catalogue national SPA vérifié, avec réutilisation des noms après départ. Navigation Archives unifiée, anciens liens conservés. [Détail](RELEASE_v3.5.1.md).

## 3.5.0 — 17 octobre 2026

Grandes affiches multi-animaux SPA/glass/éditorial/polaroids, thèmes clairs et mobile, persistance navigateur, prénoms à thème, assistant unique, filtres SOS/ententes, nuances orange, informations absentes masquées, visibilité privée des photos, retrait/annulation du planning, feuille de séance enrichie et sélection complète des affichettes. Registre interne protégé avec aperçu d’import Excel/CSV. Migration additive 16 → 17. [Détail](RELEASE_v3.5.md).

## 3.4.0 — 17 octobre 2026

Affiches avec origine des photos et chargements visibles, ouverture du design Canva, erreurs IA explicites, assistant conversationnel et raccourcis corrigés. Thèmes et particules saisonniers réellement appliqués aux messages/infos TV, horaires en grille, lecture web interpolée, nouveaux styles de logo et bannières personnalisables.

Miniatures C8, avatars et dernières connexions, distinction des photos locales dans les statistiques, compteurs de modifications réelles en synchronisation, couvertures des albums descendants et corbeille restaurable des photos d’animaux. Compression WebP des archives après sauvegarde complète relue et vérifiée, protégée de la rotation, sans traiter les fichiers partagés avec des médias actifs. Limite audio/vidéo configurable via `MAX_MEDIA_MB`.

[Détail de la version](RELEASE_v3.4.md) · [Archives et récupération des originaux](docs/ARCHIVES.md) · [Validation et limites](VALIDATION.md)

## 3.3.0 · 17 octobre 2026

Correctif Portainer : compilation explicite depuis Git (`pull_policy: build`), distinction de la stack avec image locale préconstruite et vérification CI des politiques d’image et des volumes.

Chargement et cache commun des photos SPA, prélecture contrôlée du studio/TV, bilan annuel réorganisé et message de fin personnalisable. Albums avec vidéos, déplacements et corbeille, progression des imports, navigation au clic molette, zoom corrigé, archives espèce/année et ententes mieux séparées. Journal d’administration et diagnostic de stockage. Correction Canva/PIN, lockfile npm régénéré, CI Docker complète et préparation NAS sûre.

Nettoyage : ancien code de présentation GPIC et assets retirés, historique documentaire regroupé, logo à quatre doigts régénérable et bundle vidéo reconstruit sans fichiers résiduels.

[Détail de la version](RELEASE_v3.3.md) · [Validation et limites](VALIDATION.md)

## 3.2

Comparaison indicative des photos SPA, dates de séries, widgets d’accueil, PIN, connexion agent par réseau, GeoIP, timeline TV et affichettes en série. [Notes](docs/history/RELEASE_v3.2.md).

## 3.1 et précédentes

[3.1](docs/history/RELEASE_v3.1.md) · [3.0](docs/history/RELEASE_v3.0.md) · [2.9](docs/history/RELEASE_v2.9.md) · [2.8](docs/history/RELEASE_v2.8.md)

© 2026 Gaerisson.
