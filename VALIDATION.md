# Vérifications — AniPic 3.3.0

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

## Historique des contrôles

[Rapports des versions précédentes](docs/history/VALIDATION_2_3.md).
