# Vérifications — AniPic 3.10.3

## V3.10.3 — Interface, posters et synchronisation réactive

**244 tests réussis**, aucun échec ni test ignoré, suite complète en 131,8 secondes sous Node.js 24.18.1. Huit tests ajoutés : ressources `dist/` avec repli développement, erreur explicite si absentes, export réel de poster dans une copie de production sans `public/`, intervalles de 15 minutes validés par l’API, refus des confirmations trop rapprochées ou rejouées, reprise progressive des jobs échoués/partiels, alerte après synchronisation partielle, contrôle indépendant des totaux par espèce et refus des identifiants présents dans plusieurs espèces.

**Vérification réelle de l’API SPA le 18 octobre 2026 à 05:58, heure de Paris :** trois passages complets et stables de 66 animaux, 16 requêtes, aucune erreur. Le diagnostic a utilisé une base de démonstration en lecture seule et n’a appliqué aucune fiche (`applied: false`). Ce contrôle ponctuel ne garantit pas la disponibilité future du service SPA et ne remplace pas une inspection de l’installation Portainer.

**Vérification visuelle interactive dans le navigateur :** thèmes SPA clair et Studio nuit ; menu de liste devant l’alerte, menu de fiche, bouton séance ouvrant son formulaire, retouche accessible depuis le menu, Échap fermant seulement le menu, disposition des informations hors menu, page équipe/Google et cartes d’accueil. Essais à la taille de fenêtre existante puis à 390 × 844 px : menu dans l’écran, formulaire en une colonne, aucune largeur de document dépassant le viewport sur les pages contrôlées. Surfaces, bordures, transparence, ombres et arrondis de l’horloge/météo comparés aux cartes de la photothèque en sombre. Taille temporaire et thème initial rétablis après les essais. Aucune demande ni configuration Google n’a été enregistrée pendant ces contrôles. Cette revue des écrans signalés ne garantit pas tous les états possibles du logiciel.

**Installation propre `npm ci` réussie** avec les manifestes 3.10.3 : 464 packages installés, 465 audités, aucune vulnérabilité signalée. Aucune dépendance ajoutée. Builds frontend et vidéo réussis ; avertissement Vite non bloquant pour le bundle principal d’environ 504 kB minifiés. Les six variantes Compose et les métadonnées de release sont contrôlées séparément. Le test de métadonnées utilise un environnement CI simulé.

**Démonstration relancée en 3.10.3** après sauvegarde SQLite cohérente. Tables métier, médias et sessions encore valides conservés, schéma 21 inchangé, intégrité et clés étrangères vérifiées. Les requêtes de test ont normalement alimenté les visites et le journal HTTP ; la rotation existante a retiré des entrées HTTP les plus anciennes au-delà de la limite de conservation. Aucun animal, photo, album ou projet réel de la démonstration n’a été modifié. Aucun paramètre de fréquence ou d’adoption n’a été changé dans cette base.

**Non exécutés :** construction/démarrage de l’image Docker, workflow GitHub en ligne et déploiement réel Portainer/NAS, faute de moteur Docker disponible. La simulation de structure de production exporte réellement un PNG mais ne remplace pas un démarrage de conteneur. Le smoke test de l’image en CI inclut désormais ce poster en plus du rendu MP4. Aucun volume ni montage persistant modifié ; aucune publication GitHub/GHCR effectuée ici.

## V3.10.2 — Synchronisation, interface, listes et corbeille

**236 tests réussis**, aucun échec ni test ignoré, suite complète en 132,4 secondes sous Node.js 24.18.1. Les quinze nouveaux tests vérifient les absences distinctes des adoptions, la présence actualisée avant la prochaine confirmation d’archivage, le diagnostic sans écriture, le refus d’un inventaire antérieur, les dates de modification réellement inchangées, le tri selon les seules photos locales visibles, la pagination 200, le CSV sur tous les résultats filtrés et la protection contre les formules Excel. Ils vérifient aussi les alertes d’accueil sur les écarts de nombres **et d’identifiants à nombre égal**, les contrôles anciens, incomplets ou échoués et les permissions de consultation.

Le mode d’adoption automatique est testé explicitement : activation volontaire, deux absences sûres espacées, aucun double comptage, photos et confidentialité conservées, API/CSV/gazette avec provenance. Inventaires incomplets, filtrés, anciens ou à baisse suspecte bloqués. Retour de l’animal : retrait du seul événement déduit, statut et compteurs corrigés, observations indépendantes conservées. Un statut source explicitement adopté confirme sans doublon. Les archives manuelles et fiches en corbeille restent protégées ; seuls les administrateurs peuvent changer le mode. Le mode par défaut reste sans adoption déduite. Un diagnostic plus récent, mais sans écriture, ne peut pas masquer l’échec d’une synchronisation.

**Corbeille testée avec de vraies opérations dans des dossiers temporaires isolés :** suppression/restauration d’une archive avec confidentialité et octets conservés, sauvegarde TAR vérifiée puis restaurée, original partagé conservé, empreinte de cache retirée, photo utilisée par un projet protégée, sauvegarde exclue de la rotation et job de vidage achevé. La panne du dossier de sauvegarde et l’absence des marqueurs NAS sont simulées explicitement : aucune suppression ni création d’un dossier local de remplacement. Aucun vidage ni déplacement n’a été effectué sur les médias habituels.

**API SPA réellement interrogée le 18 octobre 2026**, avec les paramètres du diagnostic fourni et les budgets de requêtes existants : trois inventaires complets et stables de **66 animaux**, 16 requêtes, aucune erreur de collecte. O’MALLEY (`spa:250747`) et DELTA (`spa:247356`) ne sont pas dans cet inventaire ; aucun statut explicite d’adoption n’a été obtenu pour eux. La comparaison locale utilise la base de démonstration en lecture seule, et ne représente pas une inspection de la base Portainer. Le diagnostic n’a importé ni archivé aucune fiche (`applied: false`). La réponse HTML publique étant une application JavaScript, elle ne sert pas à affirmer un effectif complet.

**Installation propre `npm ci` réussie** avec les manifestes 3.10.2 : 464 packages installés, 465 audités, aucune vulnérabilité signalée. Aucune dépendance ajoutée. Builds frontend et vidéo réussis. Vite signale un avertissement non bloquant pour le bundle principal légèrement supérieur à 500 kB minifiés. Les six configurations Compose (source, local, GHCR, avec et sans C8+Import) et les métadonnées de release sont vérifiées sans moteur Docker. Le contrôle de métadonnées utilise un environnement CI simulé ; aucune image/release n’a été publiée.

**Contrôle SSR statique :** alerte d’accueil et effectifs privés, libellés échappés, menus repliés, portrait SPA sans filigrane appareil dans les suggestions, badges nouvelle fiche/nouvelle série, cartes anciennes et options de liste jusqu’à 200, sélection du mode d’adoption automatique et badge de provenance. Le portail est aplati uniquement pour ce contrôle. Cela ne vérifie pas visuellement le rendu ou les interactions du navigateur. Les règles du halo ont été placées après les thèmes avec une spécificité couvrant les surfaces glass et leurs survols.

**Démonstration relancée en 3.10.2**, après sauvegarde cohérente. Toutes les tables hors sessions ont les mêmes lignes et hachages ; les sessions encore valides sont conservées. Les 79 animaux, 14 photos, 17 blobs, trois albums, deux imports et quatre projets restent intacts. Santé HTTP valide, intégrité et clés étrangères valides. Schéma SQLite 21 inchangé, aucun montage Docker/NAS modifié.

**Non exécutés :** vérification visuelle interactive, construction/démarrage de l’image Docker, workflow GitHub en ligne, déploiement Portainer et essai de panne sur un NAS physique. Les simulations de panne et le test réel de l’API ne remplacent pas ces essais. Les adoptions automatiques ont été exercées uniquement dans les bases temporaires des tests. Aucune fiche de la démonstration habituelle ni aucune base de production n’a été reclassée. L’option n’a pas été activée dans la base habituelle.

## V3.10.1 — Attribution, réattribution et suggestions visuelles

**221 tests réussis**, aucun échec ni test ignoré, suite complète en 121,0 secondes sous Node.js 24.18.1. Les dix nouveaux tests couvrent l’attribution publique par défaut, le choix privé explicite, les doublons (dont la corbeille), la conservation des octets/identités/légendes/commentaires/favoris/albums/tags, les couvertures, l’annulation successive, les modifications concurrentes, les références créées après attribution, les rôles, CSRF et origine, le propriétaire d’un jeton et son expiration. Le raccourci respecte l’annulation native des champs texte et fonctionne depuis les cases de sélection.

Les suggestions sont testées avec des images synthétiques, un redimensionnement/recompression JPEG et un serveur SPA simulé : résultats progressifs, provenance locale/SPA, exclusion des fiches parties/archivées/d’origine, indisponibilité d’une image, cache, sélection périmée, permissions et absence de modification des originaux ou des attributions. Ces tests ne mesurent pas une précision de reconnaissance sur de vrais animaux. La comparaison de couleurs et de contraste reste indicative, avec validation manuelle obligatoire.

**Installation propre `npm ci` réussie** dans un dossier neuf sous Node.js 24 : 464 packages installés, 465 audités, zéro vulnérabilité signalée. Aucune dépendance ajoutée ; versions manifest/lockfile mises à jour via npm. Builds frontend et vidéo réussis. Les six configurations Compose (source, image locale, GHCR, chacune avec et sans C8+Import) passent le contrôle des versions et protections de montage. Métadonnées de release vérifiées avec un environnement CI simulé ; aucune publication exécutée.

**Contrôle statique SSR** des deux dialogues avec portail aplati uniquement pour ce contrôle : composants chargés, case privée décochée, absence de cette case en réattribution, libellés et chargement des suggestions présents. Ce contrôle ne remplace pas une vérification visuelle interactive.

**Démonstration relancée**, après sauvegarde SQLite cohérente : toutes les tables hors sessions strictement conservées par comparaison des lignes et hachages, sessions encore valides intactes, intégrité et clés étrangères valides. Les 79 animaux, 14 photos, 17 blobs, trois albums, deux imports et quatre projets restent intacts. Aucun déplacement effectué sur les photos réelles de démonstration. Schéma SQLite 21 inchangé ; aucun volume ou montage modifié.

**Non exécutés :** vérification visuelle interactive, essai sur un vrai catalogue de portraits SPA, construction/démarrage Docker (moteur absent), CI GitHub en ligne et déploiement Portainer/NAS. Les pannes SPA sont simulées explicitement dans les tests ; l’accès réel au site n’est pas nécessaire à ces tests. L’image GHCR 3.10.1 ne doit être considérée comme publiée qu’après réussite du workflow prévu.

## Livraison Docker / GitHub — 18 octobre 2026

Suite locale complète : **210 tests réussis**, aucun échec ni test ignoré, en 163,4 s. Les trois tests ciblés de livraison ont ensuite réussi, dont un nouveau scénario exécutant le vrai script de publication avec transport GitHub/Docker/gh explicitement simulé : panne de push laissant la release en brouillon, refus d’un tag lié à un autre commit et publication seulement après envoi des fichiers.

Les six configurations Compose (sources, image locale, GHCR, chacune avec ou sans C8+Import) sont vérifiées. Les versions de leurs images et du label Docker sont comparées au manifeste. Le contrôle NAS accepte les deux représentations JSON de `false` sans accepter `true` ni une source dépourvue de protection explicite. Workflow vérifié avec actionlint 1.7.12 ; liens de documentation contrôlés.

Le dernier échec GitHub du job Docker provenait d’un booléen `false` omis dans le JSON de Compose. Ce contrôle est corrigé. Le workflow exige désormais tests, builds et essai Docker réels avant toute publication. Les résultats en ligne du commit exact sont la référence pour l’image publiée ; les essais locaux ci-dessus ne constituent pas un build Docker local ni une validation du NAS ou de la TV physique.

Les nouveaux jobs de publication n’ont pas été exécutés en ligne pendant cette préparation : l’envoi GitHub est bloqué par les autorisations de la session. Aucune nouvelle image ni release n’a donc été publiée ici. Docker Engine reste absent du poste local. Après envoi des fichiers, lancer le workflow avec l’option **publish** et contrôler ses trois jobs avant de déployer l’image GHCR.

Nettoyage : douze anciennes notes déplacées dans `docs/history/` avec liens corrigés, 59 anciens ZIP/sommes de contrôle supprimés des livraisons locales (1,59 Go). Bases, médias, sauvegardes et fonctions existantes conservés. Les dépendances npm et leur lockfile n’ont pas changé pendant cette préparation.

## V3.10.0 — 18 octobre 2026

**208 tests réussis**, aucun échec ni test ignoré, suite complète en 119,7 s. Les neuf tests du suivi vérifient le PIN, les identités d’écran, les rôles, CSRF et origine, les entrées limitées, le silence réseau, les réglages en attente, la pause, l’onglet masqué, le blocage de lecture, les incidents et reprises, les conflits de renommage, la révocation et les limites d’inscription. Un scénario utilise le vrai client de télémétrie avec une horloge contrôlée et les routes HTTP de test, sans simuler les écritures SQLite. Les identités persistent après réouverture de la base.

Les 31 tests ciblés du suivi, des accès TV, de l’agenda et des rendus avaient réussi. Après le dernier ajustement du diagnostic vidéo, les onze tests du suivi et des médias ont également réussi. Une ancienne attente de test sur le libellé « ok » a été adaptée à la règle Oui/Non stricte de 3.9.1 ; les réponses nuancées restent conservées.

**Installation propre npm sous Node.js 24.18.1 :** 464 packages installés, 465 audités, aucune vulnérabilité signalée. Builds frontend et vidéo réussis. Les configurations Compose base, C8+Import et Portainer sont vérifiées avec le client officiel, sans modifier les montages. Aucun nouveau service ou paquet ajouté. La migration SQLite 20 → 21 ajoute deux tables et un index.

**Composants chargés en SSR :** lecteur public, configuration agent, suivi privé et commande de réactivation. Les libellés restent échappés. Ce contrôle de chargement ne constitue pas une vérification visuelle interactive.

**Démonstration relancée en 3.10.0**, après sauvegarde cohérente de SQLite. Les 14 tables existantes hors sessions ont les mêmes lignes et hachages, et toutes les sessions encore valides sont conservées. L’événement de l’agenda existant, les 79 animaux, 14 photos, 17 blobs, trois albums, quatre projets vidéo, deux imports, cinq demandes et 86 paramètres sont intacts. Intégrité et clés étrangères valides ; accès anonyme au suivi refusé par le serveur réel (HTTP 401). Aucun écran fictif n’a été inscrit dans la base habituelle.

**Limites :** pas de TV physique disponible pour un essai réel, ni de nouvelle vérification visuelle interactive du navigateur. Les pertes de connexion, blocages et reprises sont simulés explicitement dans les tests ; cela ne remplace pas l’essai sur le navigateur du téléviseur. Construction/démarrage Docker, CI GitHub en ligne et déploiement Portainer/NAS non exécutés ici, faute de moteur Docker. Aucun volume existant supprimé ou réinitialisé.

## V3.9.1 — 18 octobre 2026

**25 tests ciblés réussis**, aucun échec ni test ignoré, en 19,2 s. Les tests couvrent les réponses Oui/Non seules, les précisions, les descriptions libres sans oui/non, les réponses à tester, les valeurs absentes, les filtres combinés et les rendus existants. La suite complète de 199 tests ci-dessous correspond à la version 3.9.0 et n’a pas été relancée pour ce correctif ciblé.

Builds frontend et vidéo réussis sous Node.js 24.18.1. `npm ci` propre réussi : 464 packages installés, 465 audités et zéro vulnérabilité signalée. Serveur de démonstration relancé en 3.9.1. Aucun changement des dépendances, de SQLite ou des montages Docker. Le texte et les faits SPA sont conservés. La vérification visuelle interactive du navigateur et le build Docker restent non exécutés ici.

## V3.9.0 — 18 octobre 2026

**199 tests réussis**, aucun échec ni test ignoré, suite complète en 118,1 s. Après le dernier ajustement du texte du résumé, les dix tests de la gazette et de l’agenda ont été relancés : dix réussis. Les 25 tests ciblés couvrant l’atelier, les migrations et les comportements existants avaient également réussi.

L’agenda est testé pour les accès anonymes, rôles lecteur et bénévole, CSRF, dates et heures invalides, événements sur plusieurs jours, modifications entre membres, conflit de révision et retrait conservé en base. L’intégration gazette/TV exclut les événements internes, annulés ou hors période, reprend les changements et distingue les choix de publication. Le mode fond d’écran n’intègre pas l’agenda.

La gazette automatique est testée sans sélection manuelle : arrivées et adoptions vérifiées, portraits répartis entre espèces, exclusion des archives de la sélection courante, portraits masqués, résumé des mouvements retenus, PDF et PNG réels. Le transport SPA est simulé. Une image absente produit un portrait explicite sans interrompre toute l’édition. Les tests existants conservent les contrôles de confidentialité et de propriété des exports.

**Interface :** compilation complète et chargement SSR des nouveaux composants avec les profils administration, agent, bénévole, lecteur et visiteur. Présence des actions autorisées et structure des labels contrôlées. Revue CSS des formulaires, grilles, en-têtes, boutons, fermeture des fenêtres et cartes pour les petits écrans. **Aucune nouvelle vérification visuelle interactive du navigateur : ces contrôles ne garantissent pas à eux seuls tous les placements réels.**

**PDF :** trois exemples de six pages, avec résumé automatique et photos de démonstration, rendus avec Poppler. Couvertures SPA, éditoriale et glass, portraits, dates clés et visuel réseaux inspectés. Les mouvements/dates de ces exemples de mise en page sont fictifs.

**npm ci propre sous Node.js 24.18.1 réussi :** 464 packages installés, 465 audités, zéro vulnérabilité signalée. Version du manifeste et du lockfile modifiée par npm. Builds frontend et vidéo réussis. Configurations Compose de base, C8+Import et Portainer vérifiées avec le client officiel ; montages inchangés. Migration 19 → 20 testée sans perte de brouillons, animaux ou sessions ; ajout d’une table d’agenda et de son index.

**Démonstration relancée sur http://localhost:3036 en 3.9.0**, après sauvegarde SQLite cohérente. Sur la base habituelle, 13 tables existantes ont exactement les mêmes lignes et hachages ; toutes les sessions encore valides sont identiques. Une session déjà expirée a été supprimée par le nettoyage normal au démarrage. Les 79 animaux, 14 photos, 17 blobs, trois albums, quatre projets vidéo, deux imports, cinq demandes et 86 paramètres sont conservés. Intégrité SQLite et clés étrangères vérifiées.

**Non exécutés : construction et démarrage réels de l’image Docker, CI GitHub en ligne, déploiement Portainer/NAS et partage WhatsApp réel.** Aucun moteur Docker n’est disponible ici. Aucun volume existant n’a été supprimé ni réinitialisé. Les erreurs ou avertissements historiques ci-dessous ne remplacent pas ces limites de validation.

## V3.8.0 — 18 octobre 2026

**194 tests réussis**, aucun échec ni test ignoré, suite complète en 122,2 s. Les cinq tests dédiés à la nouvelle gazette ont également été relancés après le dernier ajustement de normalisation des textes : cinq réussis. Les champs trimés par le serveur ne rendent plus une édition tout juste générée artificiellement « modifiée ». Les treize tests ciblés de l’atelier et de la gazette avaient réussi avant le contrôle complet.

Les nouveaux tests vérifient les dates d’arrivée issues des faits SPA, sans confusion avec l’import des fiches, les adoptions issues de statuts datés, l’exclusion des simples archives, les corrections réservées à l’édition, les masquages et les dates clés futures. Dates impossibles et heures invalides refusées. Brouillons, sessions, rôles et CSRF testés ; catalogue des animaux archivés limité aux faits publics et aux créateurs autorisés.

**Exports réels PDF, PNG, JPEG et ZIP** testés avec un transport de photos SPA simulé. Scénario à huit arrivées, une adoption et un rendez-vous : six pages PDF, six JPEG et un visuel PNG 1080 × 1350. Une photo absente produit une carte explicite avec nom et date, et un avertissement ; une photo privée est remplacée par la référence SPA disponible. Les accès anonymes ou d’un autre compte sont refusés pour tous les fichiers. Les originaux et leur confidentialité restent inchangés.

**Partage de fichiers testé sans envoi réel** : fichier préparé avant le clic, appel natif simulé avec le fichier et le texte, absence de substitution par une URL privée, détection d’un navigateur non compatible, annulation du partage et refus d’une réponse HTML inattendue. Aucun message WhatsApp, aucune publication ni connexion à un compte Meta n’a été effectué.

**Contrôle visuel des PDF et images** : exemples avec vraies photos de démonstration en trois styles, chacun avec six pages, plus visuels réseaux. PDF rendus avec Poppler ; rubriques adoptions/arrivées, grandes cartes pour les petits effectifs, agenda, textes, pied de page et logo transparent inspectés. Le rendu final utilise des libellés neutres pour les mouvements. Les dates et adoptions des exemples de mise en page sont fictives, uniquement destinées aux contrôles.

**Installation propre Node.js 24.18.1 : npm ci réussi**, 464 packages installés, 465 audités, zéro vulnérabilité signalée. Manifeste et lockfile version 3.8.0 synchronisés par npm. Builds frontend et vidéo réussis, bundle principal sous 500 Ko. Configurations Compose base, C8+Import et Portainer validées avec le client officiel. git diff --check et liens de documentation contrôlés. Aucun montage, volume ni configuration NAS modifié.

**Serveur de test relancé sur http://localhost:3036, version 3.8.0.** Sauvegarde cohérente de SQLite avant redémarrage puis comparaison de 14 tables : comptes, sessions, animaux, photos, blobs, albums/liens, projets, imports, planning, paramètres, décisions photo, affiches et brouillons. Nombres et hachages des lignes inchangés. Schéma 19 conservé, intégrité et clés étrangères valides. 79 animaux, 14 photos, 17 blobs, trois albums, deux imports, quatre projets et les deux sessions existantes conservés. Aucun original ni donnée de travail supprimé.

L’assistant de tri et le détourage sont retirés du menu. Leurs données et API existantes sont conservées ; les tests de non-régression de ces API restent exécutés.

**Non exécuté :** essai interactif dans le navigateur et dans l’application WhatsApp sur l’appareil de l’utilisateur, build/démarrage Docker (moteur absent), CI GitHub en ligne, déploiement Portainer/NAS réel. Le partage dépend des capacités du navigateur et des applications installées ; les exports téléchargeables constituent le repli prévu. La validation Compose ne remplace pas le test de l’image Docker.

## V3.7.0 — 17 octobre 2026

**189 tests réussis**, aucun échec ni test ignoré, suite complète finale en 106,2 s. Huit nouveaux tests couvrent les mesures de qualité, la comparaison locale/SPA et ses erreurs, les décisions mémorisées, le masque de détourage et sa copie, les affiches de box avec conflits de modification, les photos privées, la panne du moteur, le refus avant chargement si la mémoire manque et la gazette réelle. Les tests existants de PIN, Google/bénévoles, Canva, albums, NAS, archives et vidéo restent réussis.

Le tri analyse réellement les octets JPEG/WebP de test avec Sharp : netteté, flou, exposition et dimensions. Le transport SPA est simulé ; aucun portrait de référence n’est ajouté aux originaux. Les décisions ne suppriment aucune photo. Les exports Gazette des tests sont de véritables PDF avec images et aperçus, et les autres comptes ne peuvent pas télécharger une préparation privée. Aucune adoption n’est déduite d’un archivage. Les scénarios de photo manquante et de photo privée sont vérifiés.

**Détourage réel exécuté**, avec téléchargement du modèle BiRefNet lite 512, révision fixe 962e67969ec6acec9c19fab76acee4f5e22e990c, puis nouvelle inférence depuis le cache. Dernière mesure sur ce PC : 4,9 s et pic RSS de 1 911 152 Ko, soit environ 2 Go pour le processus de test. PNG transparent et rendu sur fond uni inspectés visuellement sur une photo de chien : animal et fleur conservés, fond retiré. Ce résultat ne garantit pas le contour de chaque animal ni les performances d’un NAS. Le modèle 512 calcule un masque à résolution réduite ; les très fins détails peuvent nécessiter une retouche. Un seul détourage à la fois, worker libéré et contrôle préalable de 3 Gio disponibles. Les tests HTTP de masque utilisent un processeur simulé distinct de cette inférence réelle. Test natif ONNX CPU réussi sur un petit graphe Identity ; le smoke test Docker l’exécutera aussi dans l’image.

**Gazette contrôlée visuellement** en trois styles sur de vraies photos de démonstration. Trois pages par exemple : couverture, portraits et nouvelles. PDF rendus avec Poppler et images des pages inspectées ; espacements, contraste et logo transparent vérifiés. Les textes longs sont continués sur des pages supplémentaires. Le navigateur interactif n’a pas été revalidé dans cet environnement.

**npm ci propre sous Node.js 24.18.1 réussi** : 464 packages installés, 465 audités, zéro vulnérabilité signalée. Lockfile régénéré uniquement par npm, manifeste et lockfile à 3.7.0. Builds frontend et vidéo réussis. Atelier chargé à la demande pour conserver le bundle principal sous 500 Ko. Configurations Compose base, C8+Import et Portainer validées avec le client officiel ; montages et politiques conservés. Docker utilise ONNX CPU sans téléchargement CUDA facultatif. Licences tierces incluses. git diff --check et liens de documentation contrôlés.

**Migration 18 → 19 répétée sur une copie cohérente de la base habituelle**, après sauvegarde SQLite. Comptes, sessions, animaux, photos, blobs, albums/liens, projets vidéo, imports, planning et paramètres : nombres et hachages des lignes inchangés. Intégrité et clés étrangères valides, réouverture réussie. La migration ajoute seulement trois tables et un index. Serveur de test relancé sur http://localhost:3036, version 3.7.0, schéma 19. Les 79 animaux, 14 photos, 17 blobs, trois albums, deux imports et quatre projets sont conservés. Aucun jeu de données fictif supplémentaire ni original modifié sur la base habituelle.

**Non exécuté : build/démarrage Docker, CI GitHub en ligne, déploiement Portainer/NAS réel, détourage sur le NAS de production et vérification visuelle interactive du navigateur.** Aucun moteur Docker n’est disponible ici. La validation Compose, le contrôle des bibliothèques et l’inférence Windows ne remplacent pas le test de l’image Linux. Aucun volume existant n’a été supprimé ou réinitialisé.

## V3.6.0 — 17 octobre 2026

**181 tests réussis**, aucun échec ni test ignoré, suite complète finale en 140,3 s. Les 22 tests ciblés de migration/authentification/exports/PIN/révisions avaient également réussi. La première suite avait identifié une transaction imbriquée dans l’enregistrement Google ; cette erreur est corrigée et l’intégralité de la suite a été relancée sur le code final.

Google : vérification réelle des signatures RSA par la bibliothèque officielle avec clés locales de test ; transport vers Google simulé. Tests de PKCE S256, state lié au navigateur, nonce, usage unique et expiration, mauvais émetteur/audience/signature, e-mail non confirmé, refus/approbation/désactivation. Aucun compte équipe ni session avant validation ; absence de fusion automatique par e-mail ou nom ; rôle du JWT ignoré au profit du rôle AniPic. Une identité en attente reste refusée même si un champ active est accidentellement positionné. Mise à jour générique d’un compte en attente refusée. PIN global toujours actif hors des routes d’entrée Google ciblées. Test de secret enregistré par l’interface, jamais renvoyé ni inclus dans l’export des paramètres ; désactivation du connecteur testée.

Rôle bénévole : accès aux API de création vidéo/assets, albums, statistiques, C8, archives et tags ; création effective d’un projet vidéo à partir d’une référence SPA, attribué au bénévole. Administration, comptes, configuration TV, registre interne et archivage d’un animal refusés. Retouches enregistrées en copie, sans remplacer l’original. Les tests d’accès existants des autres rôles restent réussis.

Affiches : scénario de **68 fiches avec générateur d’images simulé**, véritables PDF et ZIP : 68 pages réparties dans sept PDF de dix pages maximum, progression persistée et fichier téléchargeable par le seul propriétaire ou l’administration. Contrôles session/CSRF et refus à un autre compte. Photo simulée indisponible : les deux pages réussies d’une sélection de trois restent exportables, avec rapport d’erreur dans le ZIP. Un rendu réel d’affiche confirme l’inclusion JPEG à qualité d’impression et un PDF de moins de 2 Mo sur l’image de test, au lieu des intermédiaires PNG. Ce n’est pas un export des 68 photos du NAS de production.

**Migration 17 → 18 répétée sur une copie cohérente de la base habituelle**, après sauvegarde SQLite. Comparaison des comptes, sessions, animaux, photos, blobs, albums/liens, projets, imports, planning et paramètres : nombres et hachages des lignes identiques. Schéma 18, intégrité ok, aucune erreur de clé étrangère, réouverture réussie. La migration utilise une transaction et réactive les clés étrangères même en cas d’échec. Après validation, serveur de démonstration relancé sur http://localhost:3036, health version 3.6.0. 79 animaux, 14 photos, 2 imports et 4 projets conservés. Google reste désactivé et non configuré sur cette base ; aucun faux identifiant n’a été ajouté.

**Installation propre Node.js 24.18.1 : npm ci réussi**, 429 packages installés, 430 audités, zéro vulnérabilité signalée. Dépendance officielle google-auth-library installée par npm et lockfile régénéré, versions du manifeste et du lock synchronisées à 3.6.0. Builds frontend et vidéo réussis. Configurations Compose base, C8+Import et stack Portainer validées avec le client officiel ; mêmes volumes et protections NAS, seules les variables OAuth ont été ajoutées. git diff --check, liens de documentation et intégrité ZIP contrôlés. Aucun original ni montage NAS modifié.

**Non exécuté :** connexion réelle Google (identifiants OAuth de l’utilisateur nécessaires), vérification visuelle interactive du navigateur, build/démarrage Docker et smoke test de l’image (moteur Docker absent), CI GitHub, déploiement Portainer/NAS réel, export des photos de production ou essai sur TV physique. La validation Compose ne remplace pas le démarrage d’une image Docker.

## V3.5.4 — 17 octobre 2026

Suite complète : **172 tests réussis**, aucun échec ni test ignoré. Les 11 tests ciblés initiaux photos/TV/ententes/filtres/affiches/registre avaient également réussi.

Deux nouvelles régressions automatisées : (1) une image JPEG réelle de 2 400 × 1 600 produit un aperçu de 1 280 px et un original inline identique octet par octet, sans recompression ; refus de l’original à un visiteur, même avec le seul cookie PIN, y compris si l’album devient public ; session Lecteur valide acceptée, expirée refusée et téléchargement attachment conservé. (2) rendu réel des composants TV en HTML, par Vite SSR/React : titres et descriptions des quatre styles en portrait et paysage, titres/compteurs statistiques, messages saisonniers, informations SPA et horaires possèdent leurs couleurs explicites. Cela vérifie le rendu des composants, sans prétendre à un essai visuel dans le navigateur ou sur une TV physique.

Ententes : cas « Mâle oui selon profil », « Femelle : non avec les chats » et réponses avec oui/non dans une phrase classés en conditional. Texte conservé, oui/non simples inchangés, « Non testé » inconnu. Absence de faux positif sur « Épanoui » ou « Nonchalant ». Le filtre serveur chiens=conditional retrouve la fiche portant la nouvelle formulation.

API SPA : une requête publique réelle confirme HTTP 200 JSON, results/nb_pages/total ; 31 chiens annoncés sur 2 pages à Morée, première page de 18. Aucun inventaire appliqué à AniPic. API locale : lecture réelle du catalogue paginé, d’une fiche, des changements publics avec baseline et du fil paginé ; formes de réponse conformes aux exemples du nouveau guide. Aucune clé API Bearer inventée : documentation des sessions, PIN et restrictions d’accès existantes.

Installation propre Node.js 24.18.1 : **npm ci réussi**, 409 packages installés, 410 audités, zéro vulnérabilité signalée. Manifeste et lockfile synchronisés à 3.5.4 via npm, sans nouvelle dépendance ni version transitive modifiée manuellement. Frontend et composition vidéo compilés. Client Compose officiel : base, C8+Import et Portainer contrôlés ; montages et politiques d’image inchangés. git diff --check réussi. Liens de documentation et intégrité ZIP contrôlés.

Serveur de test relancé sur http://localhost:3036, health ok version 3.5.4. SQLite : intégrité ok, schéma 17 sans migration, 79 animaux, 14 photos, 2 photos à trier et 4 projets vidéo conservés. Les tests utilisent des bases et images isolées. Aucun original utilisateur, compte, PIN ou volume NAS réécrit par ces vérifications.

**Non exécuté :** contrôle visuel interactif du navigateur, TV physique, build/démarrage Docker et smoke test de l’image (moteur Docker absent), CI GitHub et déploiement Portainer/NAS réel. La validation Compose porte sur la configuration, pas sur un déploiement. Aucun appel payant IA ni envoi réel Canva.

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
