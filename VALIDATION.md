# Vérifications — AniPic 3.5.3

## V3.5.3 — 17 octobre 2026

Suite complète : **170 tests réussis**, aucun échec ni test ignoré. Les 19 tests ciblés accès/PIN/Canva avaient également réussi.

PIN : autorisation créée sans échéance côté SQLite ; cookie persistant HttpOnly, SameSite=Strict et Secure en HTTPS, renouvelé pour 400 jours. Retour avec une ancienne autorisation encore valide : conversion en autorisation permanente sans nouvelle saisie. Les accès expirés ou révoqués restent refusés. Changement du PIN, expiration de la session de compte, droits TV des agents et scénarios OAuth Canva avec/sans PIN vérifiés. Une simulation explicite de date à +50 ans et une fermeture/réouverture réelle de l’application sur la même base de test confirment que le nettoyage au démarrage conserve les autorisations permanentes. Cette simulation vérifie le serveur ; elle ne prétend pas garantir la conservation des cookies par chaque navigateur pendant cinquante ans. Aucun PIN stocké dans le navigateur.

Installation propre avec Node.js 24.18.1 : **npm ci réussi**, 409 packages installés, 410 audités, zéro vulnérabilité signalée. Manifeste et lockfile synchronisés à 3.5.3 via npm, aucune nouvelle dépendance ni modification manuelle des versions transitives. Builds frontend et vidéo réussis. Client Compose officiel : configurations de base, C8+Import et Portainer validées ; montages persistants et protections NAS conservés. git diff --check réussi. Liens de documentation et intégrité de l’archive ZIP contrôlés.

Serveur de test relancé sur http://localhost:3036, health ok version 3.5.3. SQLite : intégrité ok, schéma 17 sans migration, 79 animaux, 14 photos, 2 photos à trier et 4 projets vidéo conservés. Tests de PIN réalisés dans des bases isolées ; aucun changement du PIN ou des comptes du serveur habituel. Aucun volume NAS ni original utilisateur modifié.

**Non exécuté :** nouvelle vérification visuelle du navigateur pour ce changement, build/démarrage Docker complet et smoke test de l’image (moteur Docker absent), CI GitHub, déploiement Portainer/NAS réel et TV physique. La validation Compose porte sur les fichiers de configuration, pas sur un déploiement réel. Aucun appel payant IA ni envoi réel Canva.

## V3.5.2 — 17 octobre 2026

Suite complète finale : **169 tests réussis**, aucun échec ni test ignoré, 92,4 s. L’exécution précédant l’interruption de la conversation n’a pas été retenue comme validation ; elle a été relancée entièrement. Les 28 tests ciblés initiaux avaient également réussi.

Cinq nouveaux scénarios couvrent : lecture/aperçu/enregistrement TV par un agent SPA ; impossibilité de modifier le PIN, les comptes ou l’historique public par cette API ; audit attribué au bon agent ; refus des visiteurs, lecteurs et photographes ; CSRF absent, session expirée et données invalides refusés. Connexion automatique par IP du refuge testée avec un compte agent et session liée au réseau. L’aperçu ne publie aucun réglage non enregistré.

PIN : cookie HttpOnly, SameSite=Strict, Secure en HTTPS, expiration persistante et Max-Age ; aucun PIN dans le cookie. Autorisation conservée après expiration d’une session de compte, puis après fermeture et réouverture réelles de l’application sur la même base SQLite de test. L’autorisation PIN seule ne crée pas de compte et n’ouvre pas la configuration TV. Renouvellement d’un jeton valide lors du retour et de la lecture continue de la TV ; refus de prolonger les jetons expirés ou révoqués par changement du PIN. Tests OAuth Canva avec et sans PIN toujours réussis, y compris session/state/PKCE/expiration et isolation des utilisateurs.

**Installation propre Node.js 24.18.1** : npm ci dans un dossier neuf, 409 packages installés, 410 audités, zéro vulnérabilité signalée. Versions package.json/package-lock.json synchronisées via npm à 3.5.2, aucune dépendance ajoutée ni version transitive modifiée manuellement. Builds frontend et vidéo réussis. Client Compose officiel : base, C8+Import et portainer-stack contrôlés, volumes et politiques d’image locale conservés. git diff --check réussi.

**Navigateur** : instance isolée distincte des données et des cookies du serveur habituel. Premier écran PIN et déverrouillage correct vérifiés dans l’interface. La vérification de fermeture/réouverture d’onglet puis de la page TV sous le compte Agent SPA a été interrompue ; la reprise de l’onglet inaccessible a ensuite été bloquée par la politique de sécurité du navigateur. Elle n’est donc pas présentée comme une validation visuelle finalisée. Les accès agent et la persistance/révocation sont vérifiés par les tests d’intégration ci-dessus. Les captures antérieures de thème clair restent celles de 3.5.1.

**Serveur habituel** relancé sur http://localhost:3036, API health ok version 3.5.2. Aucune migration (schéma 17), intégrité SQLite ok et 79 animaux, 14 photos, 2 photos à trier, 4 projets vidéo conservés. Les comptes, le PIN et la configuration TV du serveur habituel n’ont pas été modifiés par la vérification isolée. Aucun volume NAS ni original utilisateur modifié.

**Non exécuté :** build/démarrage Docker complet et smoke test de l’image (moteur Docker absent), CI GitHub, déploiement Portainer/NAS réel, tests sur TV physique, appel payant IA ou envoi réel Canva.

## V3.5.1 — 17 octobre 2026

Suite complète : **164 tests réussis**, aucun échec ni test ignoré (90,7 s). Après les derniers ajustements du catalogue, **16 tests ciblés réussis**, dont les sept nouveaux scénarios sur les prénoms. Exclusion des noms actifs locaux, accents/casse/ponctuation, identifiants et annotations de titres SPA ; noms archivés, adoptés ou remplacés réutilisables. Catalogue national : toutes les pages et totaux contrôlés ; pagination répétée, partielle, modifiée, trop grande et données malformées refusées. Cache périmé sans suggestions non vérifiées, panne réseau visible, partage d’une collecte concurrente, remplacement du relevé précédent, aucun import d’animal. Routes d’actualisation protégées par session d’équipe, rôle et CSRF, session expirée refusée.

**Lecture nationale réelle** de l’API publique SPA : 248 pages, 4 457 fiches, 3 865 noms distincts, relevé terminé le 17/10/2026 à 19:53:40 (Europe/Paris). Aucun doublon d’identifiant ni différence entre le total annoncé et les fiches lues. Catalogue séparé des animaux du refuge, fourni dans shared/spa-names.json et actualisable depuis l’interface. Validité 24 h ; seuls les noms actuellement publiés et les noms locaux actifs sont exclus, sans historique d’exclusion permanent.

**Installation propre Node.js 24.18.1** : npm ci dans un dossier sans node_modules, 409 packages installés, 410 audités, zéro vulnérabilité signalée. Versions package.json/package-lock.json synchronisées à 3.5.1 via npm, sans retouche de versions transitives et sans nouvelle dépendance. Builds frontend et vidéo réussis. Configurations réelles avec le client Compose officiel : base, C8+Import et portainer-stack, politiques de construction locale et volumes vérifiés. git diff --check réussi.

**Navigateur** : parcours des pages de photothèque, albums, planning, imports, créations, refuge et administration dans les deux thèmes clairs. Surfaces calculées contrôlées avec le verre à 35 %, puis album vérifié dans les deux thèmes avec verre désactivé et réactivé. Modals blanc opaque (rgb 255,255,255), texte et séparateurs adaptés au thème. Vérifications visuelles détaillées de la fiche animal, synchronisation, outils/prénoms, téléchargement et mobile à 390 px (document 390 px, modal 374 px). Contrôle sombre sans application de surfaces blanches. L’ancien lien #departures redirige réellement vers #archives, sans seconde entrée dans le menu ; dossiers et bilan accessibles. Les captures prises pendant les transitions d’entrée n’ont pas été considérées comme des validations visuelles finales. Les réglages de verre ont été restaurés après les essais.

**Données de démonstration** : aucune migration nécessaire (schéma 17), intégrité SQLite ok ; 79 animaux, 14 photos, 2 photos à trier et 4 projets vidéo conservés. Aucun original ni volume utilisateur modifié. Serveur de test sur http://localhost:3036.

**Non exécuté :** build/démarrage Docker complet et smoke test de l’image, CI GitHub, déploiement Portainer/NAS réel (aucun moteur Docker disponible). Aucun envoi réel Canva, appel payant IA ou essai sur TV physique. L’extension Edge/Argos reste reportée à la demande de l’utilisateur.

## V3.5 — 17 octobre 2026

Suite complète : **156 tests réussis**, aucun échec ni test ignoré (83,8 s). Après le dernier ajustement de composition et l’ajout du scénario d’attente des photos SPA, **9 tests ciblés réussis** (dont l’import multipart réel, la session expirée et les droits du registre). Les nouveaux fichiers de test comptent neuf scénarios ; ne pas additionner les exécutions comme des scénarios distincts.

Installation propre **npm ci avec Node.js 24.18.1** dans un dossier sans node_modules : **409 packages, audit 410, zéro vulnérabilité signalée**. Version package.json et package-lock.json synchronisée à 3.5.0 par npm, sans modification manuelle des dépendances transitives. Builds frontend et vidéo réussis. Client Compose officiel : base, C8+Import et portainer-stack vérifiés, avec politiques d’image locale et volumes persistants inchangés. Aucune nouvelle dépendance.

Scénarios vérifiés : filtres SOS et ententes combinés, comptage/pagination serveur, qualificatifs oui/non en état orange, valeurs N/A, choix du thème et stockage indisponible, noms par thème/sexe/lettre et exclusion des noms existants. Retrait/restauration d’une demande avec contrôle de version, compteurs et feuille de séance. Photos privées exclues des routes publiques, d’un album public et de la composition collective. Registre refusé aux visiteurs, lecteurs et photographes, CSRF, édition concurrente, retrait/restauration, doublons, aperçu d’import sans écriture et session expirée. Excel avec première feuille ciblée par relation, chaînes partagées/inline, formules ignorées, XML externe et fichiers trop volumineux refusés. Génération des quatre affiches, PDF physique A4, erreur nommée si la photo manque ; attente de toutes les références SPA sans ajout aux photos locales.

Rendus des quatre grandes affiches et PDF A3 réel inspectés (Poppler), dimensions physiques vérifiées avec pypdf. Le rendu final centre la dernière rangée, conserve le logo transparent et sépare les noms, le pied de page et le QR code. Photos de démonstration utilisées. Le document A3 fait 841,89 × 1190,55 points.

Navigateur : thème SPA clair conservé après rechargement, assistant unique avec recherche/chat et panneau mobile contenu dans le viewport, prénoms Halloween, registre interne vide et import masqué derrière son bouton. Génération réelle d’une affiche de cinq portraits depuis l’interface, loader pendant la préparation et image décodée de 868 px après réponse. Vérification de débordement à 390 px et à la largeur du navigateur ; feuille de séance avec portraits agrandis. Les modèles disposent de contrôles, source locale/SPA, sélection et export fonctionnels, sans image publique générée automatiquement.

Base de démo sauvegardée avant migration **16 → 17**, intégrité SQLite **ok**, **79 animaux, 14 photos, 2 photos à trier et 4 projets vidéo** conservés ; registre resté vide. Aucun original utilisateur compressé, effacé ou déplacé. Migration additive et annulation des demandes par table de retraits, sans changer la structure des demandes existantes. Démonstration sur http://localhost:3036.

**Non exécuté :** build complet et démarrage de l’image Docker, exécution de la CI sur GitHub, déploiement Portainer/NAS réel (moteur Docker absent ici). Aucun appel payant à l’IA, aucun envoi réel Canva, aucun test sur une TV physique. L’extension Edge/Argos reste reportée avec l’accord de l’utilisateur.

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
