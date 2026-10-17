# Vérifications — AniPic 3.4.0

## V3.4 — 17 octobre 2026

Installation propre **Node.js 24.18.1 / npm ci** dans un nouveau dossier : **409 packages**, aucune vulnérabilité signalée. Aucun changement manuel de version transitive ni nouvelle dépendance ; les versions du manifeste et du lockfile sont 3.4.0.

Suite complète : **148 tests réussis**, aucun échec ni test ignoré, environ 74,5 s. Après les derniers ajustements de couvertures vidéo et de libellés d’ententes, **15 tests ciblés supplémentaires réussis**. Le test réel de miniature C8 avait révélé un problème de format couleur MJPEG ; il a été corrigé et vérifié, y compris pour une vidéo plus courte que le point d’aperçu. Builds frontend et vidéo réussis après les dernières modifications. **99 liens documentaires internes contrôlés, aucune cible manquante.** Configurations réelles du client Compose officiel vérifiées : base, C8+Import et stack avec image locale ; politiques d’image et protections des volumes conservées.

Nouveaux scénarios : erreurs IA compréhensibles sans divulguer les exceptions, réponse Gemini sans texte / budget épuisé et contenu Token Harbor sous forme de blocs, historique de chat borné et refus de rôle système, lecture sans compte refusée, avatars et permissions, dernière connexion, corbeille réversible avec fichiers conservés, couvertures de sous-albums sans fuite de dossier privé. Compression réelle avec sauvegarde complète relue, hash vérifié, récupération des originaux par restauration, protection contre une recompression et contre la rotation des sauvegardes. Pannes simulées : import simultané, sauvegarde refusée, sauvegarde réellement corrompue et dossier photos renommé pour simuler sa déconnexion, sans création d’un dossier de remplacement.

Rendus Remotion réels inspectés : Halloween paysage, informations SPA de Noël portrait, horaires en grille, cinq styles de logo, finales de bilan paysage et portrait. Les logos, statistiques, textes et horaires restent distincts. Les exportations anciennes restent inchangées.

Navigateur : sélection SPA et loader d’affiche visibles ; aperçu chargé et boutons d’export activés après préparation. Chat contextuel avec réponses simulées, Markdown, liens distinguant les homonymes par espèce/identifiant, conservation de la conversation après fermeture et message d’erreur IA vide vérifiés. Deux cartes C8 d’illustration avec miniatures décodées, même hauteur avec et sans badge Morée (316,27 px dans le viewport de test). Estimation de stockage effectuée sans modification des photos, information de sauvegarde visible et lancement de compression désactivé sans accord.

Démo principale sauvegardée avant migration **15 → 16**, intégrité SQLite `ok`. Comptes contrôlés après redémarrage : **79 animaux, 14 photos, 2 photos à trier, 4 projets vidéo**, identiques à l’état initial. Serveur local actif sur `http://localhost:3036`. Aucun reset, compression réelle des données de l’utilisateur ni changement des volumes NAS. Le serveur UI avec IA simulée a utilisé une copie isolée, sans appel au service externe.

Limites : les appels Canva/IA sont simulés dans les tests, sans requête payante ni connexion réelle à un compte Canva. La fluidité sur la TV physique n’est pas mesurée. Aucun moteur Docker disponible ici : construction complète d’image, exécution de la CI sur GitHub et déploiement Portainer/NAS réels non exécutés. Les contrôles existants de CI restent en place.


14–16 octobre 2026, Windows, Node.js 24.18.1. Données de test isolées, aucun changement dans les ZIP d’origine, l’ancienne API ou votre NAS.

## V3.3 — 17 octobre 2026

**137 tests réussis, 0 échec, 0 ignoré** sous Node.js 24.18.1, y compris sur les dépendances réellement réinstallées par `npm ci` dans un dossier isolé. Lockfile intégralement régénéré par npm, puis comparé aux dépendances directes du manifeste ; aucun numéro transitif remplacé à la main. Installation propre : 409 paquets, audit npm sans vulnérabilité signalée à cet instant. Script d’installation esbuild autorisé pour sa version via npm.

Compilations frontend Vite et vidéo Remotion réussies avec cette installation propre. Compose officiel **5.6.0**, binaire téléchargé depuis Docker et SHA-256 vérifié : `config --quiet` réussi pour `compose.yml`, les extensions C8 et Import ensemble et `portainer-stack.yml`. Les montages et noms de volumes persistants sont conservés.

`npm run verify:release` a réellement exécuté npm ci, les 137 tests et les deux builds, puis a échoué explicitement à la première étape Docker : `spawnSync docker ENOENT`. Aucun `release-validation.json` n’a été créé. **Le build complet de l’image, le démarrage de cette image, une stack Portainer, les droits Linux réels et une coupure NFS/SMB réelle n’ont pas été exécutés ici.** Le workflow GitHub est ajouté mais n’a pas été déclenché depuis cette session. La version ne bénéficie donc pas encore d’une validation Docker complète.

Le contrôle `scripts/docker-smoke.mjs` a été exécuté **localement**, hors conteneur : démarrage sans animaux de démo, santé HTTP, SQLite, ingestion Sharp, rendu MP4 réel de 2 s en 1280 × 720 ; import de ce MP4 dans un album privé, refus anonyme, lecture Range de 32 octets, mise à la corbeille et restauration. Il sera répété à l’intérieur de l’image par la CI.

NAS : simulations explicites sur de vrais dossiers temporaires avec inventaire de montage injecté. Cas couverts : partage absent avant création, montage local refusé, dossiers et marqueurs existants conservés, UID/permissions refusés simulés par EACCES, interruption de montage pendant la préparation, options C8/Import et mode contrôle. Configuration de production refusée avant mkdir quand les marqueurs manquent ; diagnostic de dossiers C8/Import absents et retrait de marqueur contrôlés. Ces simulations ne remplacent pas les essais sur votre NAS.

Canva : PIN activé et désactivé, cookie de retour sans cookies Strict, absence de connexion, autre utilisateur, autre session du même utilisateur, session expirée, état OAuth expiré, mauvais state et réutilisation refusés. Échange de jetons simulé ; aucune connexion réelle au compte Canva ni requête payante IA effectuée.

Images : demandes simultanées SPA 320/640/1280 vérifiées avec **un seul téléchargement source**, nouvelle tentative après échec, attente de la dernière image décodée, erreurs visibles et portraits/bandes sans intersection. Poster A4, visuel social et aperçu vidéo générés avec une photo SPA simulée, sans créer de portrait local. Ententes avec libellés concaténés, points-virgules et texte enfants qualifié testées ; archives par espèce/année et journal sans secrets testés.

Rendus vidéo réels : deux bilans annuels de **28 s**, H.264, paysage **1280 × 720** et portrait **720 × 1280**, six photos d’illustration, message « Bonne année 2027 ». Quatre images de contrôle inspectées : cartes latérales espacées, photo principale, logo SPA et message final séparés. Les anciens exports restent inchangés.

Navigateur : création du bilan et message de fin, aperçu chargé, boutons et informations du nouvel album, panneau de renommage/déplacement/corbeille, absence de fond fixe du titre. Double clic suivant puis précédent sur une fiche : zoom observé à **100 %**. Source SPA réelle visible dans le widget planning et le programme TV. La lecture fullscreen C8 et le comportement tactile sur TV physique n’ont pas été testés.

Migration principale **14 → 15**, sauvegarde SQLite cohérente avant redémarrage ; `PRAGMA integrity_check` = `ok`. Après migration, les comptes vérifiés restent **79 animaux, 14 photos, 2 photos à trier et 4 projets vidéo**. Pas de reset, de nouvel inventaire ni de modification du NAS. Démo locale redémarrée sur le port 3036.

## Nettoyage et logo — 17 octobre 2026

Suite complète répétée : **137 tests réussis**, 0 échec, environ 60 s. Builds frontend et vidéo réussis après suppression des anciens montages. **89 liens documentaires internes vérifiés**, aucune cible manquante. Les anciennes commandes story/trailer sont conservées comme points d’entrée du montage actuel ; la commande story a produit sept images réelles en 1080 × 1920, durée de composition 24,5 s, sans scène GPIC. Le logo a été inspecté en PNG et dans le menu de l’application à sa taille réelle. Le dossier généré du build vidéo est nettoyé explicitement pour retirer les anciennes copies publiques ; les répertoires des données ne sont pas concernés. Aucun test Docker complet supplémentaire exécuté.

## Correctif de mise à jour Portainer — 17 octobre 2026

`compose.yml` définit maintenant `pull_policy: build` pour compiler l’image locale depuis les sources. `portainer-stack.yml` reste destiné à une image préconstruite, avec `pull_policy: never`. Le téléchargement forcé dans Portainer doit rester désactivé ; le correctif n’a pas été appliqué au serveur distant depuis cette session.

Contrôle réel avec le client officiel Compose 5.6.0 : configurations de base, C8+Import et image locale acceptées. Le script `check-deploy-config.mjs`, ajouté en CI et à la procédure avant release, refuse deux régressions introduites dans des copies isolées : `pull_policy: missing` et `create_host_path: true`. Comparaison complète des modèles JSON avant/après : seule la politique de build change ; volumes, chemins, droits et variables de production restent identiques. Aucun conteneur ni volume créé. La suite applicative n’a pas été répétée pour ce changement de déploiement ; les derniers 137 tests et builds concernent le code applicatif inchangé. Construction d’image et déploiement Portainer non exécutés ici, moteur Docker indisponible.

## Historique des contrôles

[Rapports des versions précédentes](docs/history/VALIDATION_2_3.md).
