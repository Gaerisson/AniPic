# Journal des versions

## 3.11.1 — Installation Android dans le même projet

- Page `/android` avec téléchargement direct de l’APK signée, instructions, QR code et empreintes publiques.
- APK livrée dans le dépôt, le ZIP et l’image web ; contrôles de contenu, reprise du téléchargement et certificat en CI.
- Liens d’installation depuis le site et l’accueil mobile ; corrections web 3.11.0 conservées.

## 3.11.0 — Android, accueil et adoptions

- APK Android signée pour anipic.gaerisson.fr, navigation mobile Adoptions / Photos / C8 / Plus, association de domaine et écran hors connexion public.
- Météo compacte près de l’horloge ; effectifs et progression des portraits locaux par espèce ; photos et validation directe dans le fil d’accueil.
- Confirmation automatique ou après 24 h sans réponse, historique des décisions, annulation/rétablissement par les agents et refus conservés entre synchronisations.
- Compilation Android et lint en CI ; documentation d’installation, signature et mises à jour. PIN, rôles et volumes existants conservés.

## 3.10.4 — 18 octobre 2026

Fil d’accueil avec +/−/cœur, couleurs des mouvements et dates. Liste « Adoptions à confirmer » avec compteur dans le menu et validation par les agents sans double comptage. Profil rapide 2 confirmations / 30 min, synchronisation 15 min. Poster en silhouette SPA avec noms lisibles, jusqu’à 60 portraits. [Détail](RELEASE_v3.10.4.md).

## 3.10.3 — 18 octobre 2026

Menus au-dessus des cartes et des fenêtres, actions séance/publication visibles, badges sans chevauchement, formulaires équipe et titres corrigés. Horloge/météo harmonisées en sombre. Correction de l’export poster dans Docker avec ressources `dist/` et test de production ajouté. Fréquence et confirmations réglables dès 15 minutes, reprise progressive après échec/inventaire partiel, contrôles SPA par espèce renforcés et listes actualisées en arrière-plan. [Détail](RELEASE_v3.10.3.md).

## 3.10.2 — 18 octobre 2026

Alerte d’écart SPA sur l’accueil, présence « à vérifier » et diagnostic de comparaison locale/source. Option pour archiver et compter automatiquement les adoptions après absences confirmées, avec provenance et correction lors d’un retour. Interface allégée par menus contextuels, jusqu’à 200 animaux par page et export CSV filtré. Halo corrigé en thème clair/glass, dates de tri explicites et portraits de suggestions dégagés. Suppression/restauration des archives et vidage de corbeille après sauvegarde vérifiée, avec protection des originaux partagés. [Détail](RELEASE_v3.10.2.md).

## 3.10.1 — 18 octobre 2026

Attribution et réattribution de photos avec annulation Ctrl+Z, conservation des originaux et de la confidentialité, protection contre les doublons et les modifications concurrentes. Suggestions progressives de fiches par ressemblance des couleurs et du contraste, à partir des photos locales et SPA. Case « Photos privées » décochée par défaut à l’attribution. Aucun changement des dépendances, du schéma SQLite ou des montages NAS. [Détail](RELEASE_v3.10.1.md).

## 3.10.0 — 18 octobre 2026

Livraison : images Compose alignées sur 3.10.0, option GHCR dédiée et publication image/release conditionnée aux tests, builds et rendu Docker réel. Correction du contrôle des bind mounts pour Compose v2/v5 sans diminuer les protections NAS. Anciennes notes regroupées dans `docs/history/`.

Suivi TV : écrans nommés, dernier contact, actualisation du programme, séquence en cours, incidents et reprises datés, détection des écrans hors ligne et retrait du suivi. Gestion réservée aux agents SPA et à l’administration ; PIN maintenu, aperçus exclus. Migration additive 20 → 21. [Détail](RELEASE_v3.10.0.md).

## 3.9.1 — 18 octobre 2026

Ententes : seuls « Oui » et « Non » sans précision sont définitifs. Toute autre réponse renseignée est orange, y compris les descriptions sans oui/non et les ententes à tester. Texte SPA conservé ; règle commune aux fiches, filtres et vidéos. [Détail](docs/history/RELEASE_v3.9.1.md).

## 3.9.0 — 18 octobre 2026

Gazette préremplie : résumé automatique, mouvements datés, portraits répartis entre espèces et événements partagés. Agenda d’équipe avec dates clés, rendez-vous sur plusieurs jours, annulation, module d’accueil, publication TV au choix et contrôle des modifications concurrentes. Données actualisées chaque minute ; textes et placements de l’interface assouplis sur mobile. Migration additive 19 → 20, sans changement des montages Docker. [Détail](docs/history/RELEASE_v3.9.0.md).

## 3.8.0 — 18 octobre 2026

Gazette complète avec arrivées et adoptions illustrées, dates corrigibles pour chaque édition, agenda de dates clés, brouillons partagés et travail local mémorisé. PDF, pages JPEG, ZIP d’images et visuel réseaux PNG ; partage de fichiers vers WhatsApp avec repli par téléchargement. L’atelier affiche la gazette et le suivi des affiches de box. [Détail](docs/history/RELEASE_v3.8.0.md).

## 3.7.0 — 17 octobre 2026

Atelier de tri photo avec références SPA, détourage local avec réglage du contour et export PNG, suivi des affiches installées dans les box et gazette mensuelle A4 en trois styles. Préparations privées avec progression, brouillons et choix mémorisés, originaux conservés. Migration SQLite 19 et contrôle du moteur ONNX CPU dans le smoke test Docker. [Détail](docs/history/RELEASE_v3.7.0.md).

## 3.6.0 — 17 octobre 2026

Inscription Google avec validation des comptes bénévoles et droits de création dédiés. Vidéo depuis une fiche animal, albums privés, archives, statistiques et C8. Exports de fiches en arrière-plan avec progression, PDF allégés, ZIP unique et rapport des photos en erreur. Migration SQLite 17 → 18 sans changement des montages. [Détail](docs/history/RELEASE_v3.6.0.md).

## 3.5.4 — 17 octobre 2026

Originaux chargés progressivement dans les albums pour un zoom net, sans ouvrir leur accès public. Couleurs de texte TV indépendantes du thème de l’interface, y compris messages, statistiques et aperçu du bilan annuel. Ententes avec « oui/non » dans une phrase classées en orange. Guide des API SPA/AniPic avec exemples vérifiés. [Détail](docs/history/RELEASE_v3.5.4.md).

## 3.5.3 — 17 octobre 2026

Autorisation PIN sans expiration côté AniPic, conservée après redémarrage. Les anciens accès encore valides sont prolongés sans redemander le code ; changer le PIN révoque toujours les accès précédents. [Détail](docs/history/RELEASE_v3.5.3.md).

## 3.5.2 — 17 octobre 2026

Configuration TV ouverte aux agents SPA via une API dédiée, sans accès aux paramètres généraux. PIN mémorisé dans un cookie persistant de 30 jours, renouvelé lors des visites et de la diffusion, indépendant de la session de compte et révocable. [Détail](docs/history/RELEASE_v3.5.2.md).

## 3.5.1 — 17 octobre 2026

Fenêtres claires opaques sur le voile sombre, verre lisible et textes secondaires suivant le thème. Prénoms filtrés sur les animaux présents et le catalogue national SPA vérifié, avec réutilisation des noms après départ. Navigation Archives unifiée, anciens liens conservés. [Détail](docs/history/RELEASE_v3.5.1.md).

## 3.5.0 — 17 octobre 2026

Grandes affiches multi-animaux SPA/glass/éditorial/polaroids, thèmes clairs et mobile, persistance navigateur, prénoms à thème, assistant unique, filtres SOS/ententes, nuances orange, informations absentes masquées, visibilité privée des photos, retrait/annulation du planning, feuille de séance enrichie et sélection complète des affichettes. Registre interne protégé avec aperçu d’import Excel/CSV. Migration additive 16 → 17. [Détail](docs/history/RELEASE_v3.5.md).

## 3.4.0 — 17 octobre 2026

Affiches avec origine des photos et chargements visibles, ouverture du design Canva, erreurs IA explicites, assistant conversationnel et raccourcis corrigés. Thèmes et particules saisonniers réellement appliqués aux messages/infos TV, horaires en grille, lecture web interpolée, nouveaux styles de logo et bannières personnalisables.

Miniatures C8, avatars et dernières connexions, distinction des photos locales dans les statistiques, compteurs de modifications réelles en synchronisation, couvertures des albums descendants et corbeille restaurable des photos d’animaux. Compression WebP des archives après sauvegarde complète relue et vérifiée, protégée de la rotation, sans traiter les fichiers partagés avec des médias actifs. Limite audio/vidéo configurable via `MAX_MEDIA_MB`.

[Détail de la version](docs/history/RELEASE_v3.4.md) · [Archives et récupération des originaux](docs/ARCHIVES.md) · [Validation et limites](VALIDATION.md)

## 3.3.0 · 17 octobre 2026

Correctif Portainer : compilation explicite depuis Git (`pull_policy: build`), distinction de la stack avec image locale préconstruite et vérification CI des politiques d’image et des volumes.

Chargement et cache commun des photos SPA, prélecture contrôlée du studio/TV, bilan annuel réorganisé et message de fin personnalisable. Albums avec vidéos, déplacements et corbeille, progression des imports, navigation au clic molette, zoom corrigé, archives espèce/année et ententes mieux séparées. Journal d’administration et diagnostic de stockage. Correction Canva/PIN, lockfile npm régénéré, CI Docker complète et préparation NAS sûre.

Nettoyage : ancien code de présentation GPIC et assets retirés, historique documentaire regroupé, logo à quatre doigts régénérable et bundle vidéo reconstruit sans fichiers résiduels.

[Détail de la version](docs/history/RELEASE_v3.3.md) · [Validation et limites](VALIDATION.md)

## 3.2

Comparaison indicative des photos SPA, dates de séries, widgets d’accueil, PIN, connexion agent par réseau, GeoIP, timeline TV et affichettes en série. [Notes](docs/history/RELEASE_v3.2.md).

## 3.1 et précédentes

[3.1](docs/history/RELEASE_v3.1.md) · [3.0](docs/history/RELEASE_v3.0.md) · [2.9](docs/history/RELEASE_v2.9.md) · [2.8](docs/history/RELEASE_v2.8.md)

© 2026 Gaerisson.
