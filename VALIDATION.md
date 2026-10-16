# Vérifications — AniPic 3.2

14–16 octobre 2026, Windows, Node.js 24.18.1. Données de test isolées, aucun changement dans les ZIP d’origine, l’ancienne API ou votre NAS.

## V3.2 — 17 octobre 2026

**125 tests réussis, 0 échec**, suite complète en 51,9 s. Nouveaux cas : PIN, révocation, médias et absence de hash dans les réglages ; connexion agent liée à son IP, changement de compte et refus d’en-têtes falsifiés ; rate limit PIN ; GeoIP local et drapeaux ; saisons/Pâques ; suppression de séquences, rotation de sélection TV et export fixe ; annulation concurrente de planning ; comparaison photographique avec compression/transparence, invalidation du cache et référence inexploitable ; dates Paris au changement d’heure/année ; PDF A4 en série et droits ; accès public/révocation des pages émissions/statistiques/activité. Le connecteur de comparaison visuelle utilise une référence source simulée dans les tests. Après le dernier correctif, les 14 scénarios médias/TV ont repassé : supprimer une séquence coupe aussi le lien public de sa vidéo, et les aperçus non enregistrés utilisent les routes privées.

Build Vite réussi : principal **444,6 Ko / gzip 140,1 Ko**, studio **395,9 Ko / gzip 125,4 Ko**, CSS **255,8 Ko / gzip 48,2 Ko**. Admin et visiteurs chargés à la demande. Compositions Remotion recompilées.

Rendus réels : présentation story **1080 × 1920**, paysage **1920 × 1080**, **24,5 s**, H.264/AAC, 30 images/s, 40 temps sur la grille de 0,6122 s du morceau fourni. Les quatorze images de scènes ont été inspectées. Bilan **720 × 1280 / 22,5 s** et fond animé **1280 × 720 / 10 s**, H.264 sans audio ; logo couleur, photos dans sa silhouette et particules inspectés. Cinq styles d’affiches A4, QR plus grand, et PDF de deux affiches produits. Rendus Poppler des PDF inspectés ; cadrage du sujet ajusté après contrôle.

Dans le navigateur : cartes avec date locale, aperçu de téléchargement portrait avec cadre pointillé et navigation, studio avec portrait, timeline agrandie, étirement 3 → 8 s, déplacement après un message, suppression et notification de sauvegarde ; tableau visiteurs avec jours vides et accès local ; activation des six widgets ; deux annulations successives par bouton puis Ctrl+Z ; réglages et styles contrôlés sur une base isolée. L’horloge tronquée à 1265 px a été corrigée. Les préférences de sécurité ne sont pas activées dans la démo principale.

Migration additive **12 → 14**, sauvegarde cohérente conservée avant migration. Pas de remise à zéro de la base principale, ni de traitement de vos fichiers NAS. Le pays reste une estimation GeoIP ; les adresses locales n’ont pas de localisation inventée. La comparaison SPA porte sur la photo principale et ne certifie pas la publication dans toute sa galerie. Aucun appel payant IA, publication Facebook ou push GitHub pour cette version. Déploiement Docker/NAS et téléviseur physique non testés ici.

## V3.1 — 16 octobre 2026

**111 tests réussis, 0 échec**, suite complète en 49,7 s. Les quatre nouveaux scénarios vérifient l’ordre des insertions TV et le retrait de toutes les statistiques, l’accès public d’un clip uniquement quand programmé sur un écran activé et sa révocation, les réglages Mistral réservés aux admins et l’absence de fuite de clé dans réponses/exports/audit, ainsi que les visites dédupliquées liées au compte sans confiance dans un en-tête pays fourni hors proxy.

Rendus MP4 réels : **1080 × 1920 et 1920 × 1080, 19,605 s**, vidéo H.264 et piste AAC vérifiée. 32 temps sur la grille analysée de 0,6122 s (~98 BPM), extrait fourni commençant à 10,2922 s. Les images de chaque scène et des deux orientations ont été inspectées ; la colonne de titre du paysage a été corrigée pour éviter de recouvrir l’interface. Bilan annuel **720 × 1280, 22,5 s**, sans audio ; fond animé **1280 × 720, 10 s**, sans audio. Formation du logo et dévoilement final contrôlés sur des images intermédiaires.

Quatre PDF A4 actualisés, rendus par Poppler et inspectés : QR présent dans chaque style, marges et logo transparent conservés. Dans le navigateur, titre de fiche transparent, bouton Créer l’affiche de box et QR visible dans son aperçu ; programme à quatre animaux sans statistiques, insertion/position de message Halloween et aperçu par clic ; popup d’équipe, bouton Lu et message conservé dans l’assistant contrôlés sur la base isolée.

Build final Vite réussi, sans avertissement de taille : principal **495,63 Ko / gzip 152,43 Ko**, studio **395,40 Ko / gzip 125,27 Ko**, CSS **233,70 Ko / gzip 44,45 Ko**.

Migration additive 11 → 12. Sauvegarde SQLite cohérente avant migration dans `work/anipic-demo-pre-v31.sqlite`. Aucun média ni animal ajouté dans la base principale pendant ces essais. Les pays ne sont pas inventés depuis l’IP : ils nécessitent le proxy de géolocalisation configuré. Mistral a été testé avec transport simulé ; aucun appel payant réel. Les clés saisies dans l’interface restent exclues des sauvegardes et des exports. Le téléviseur physique et le déploiement Docker/NAS n’ont pas été testés ici.

## Ajustement logo transparent et pictogrammes

Le PNG SPA a déjà un canal alpha (coin transparent vérifié) : aucun détourage ni modification du logo n’a été nécessaire. Les fonds blancs des composants web/Remotion, du fond PC et des modèles PDF sont retirés. Les pictogrammes SVG chien/chat/enfants sont partagés par la fiche, la TV et l’impression. La fiche conserve les qualificatifs d’entente venant de la SPA. Les 20 tests médias/TV et équipe/affiches repassent ; les modèles PDF et les aperçus Remotion ont été régénérés pour contrôle visuel, puis inspectés : quatre affiches A4, absence de carré blanc en TV portrait et trois pictogrammes bien alignés sur la fiche dans le navigateur. Build Vite réussi (principal 488,62 Ko / gzip 150,35 Ko) et compositions Remotion recompilées. Les paragraphes de validation ci-dessous décrivent l’état précédent lorsqu’ils mentionnent un cartouche.

## V3.0 — 16 octobre 2026

**107 tests réussis, 0 échec**, suite complète en 36,7 s. Les nouveaux scénarios vérifient : droits et confidentialité des tags, dédoublonnage de casse, filtre de bibliothèque et requête SQL paramétrée ; association vidéo privée par défaut, autorisation TV explicite, exclusions, désactivation et lectures par plage d’octets ; photos multiples et filtres thématiques sans fuite de photos privées ; prévisualisation admin sans publication des réglages ; statistiques d’adoption datées sans inférence depuis une archive ; ordre/durée des séquences déterministes pour direct et Remotion ; horaires Europe/Paris et créneau passant minuit ; référence SPA prise dans le cache borné sans création d’un portrait local ; export privé, limite dix minutes, annulation prévue, retrait et restauration de la corbeille.

Après les derniers ajustements de présentation, les dix scénarios médias/TV et les dix scénarios du module équipe/affiches ont repassé avec succès. Les réglages sans effet sur une mosaïque (vidéos, ententes, statistiques, styles de fiche) ne sont pas affichés dans ce mode. Le bilan annuel a aussi été contrôlé sur trois images portrait, dont le logo final. `npm ci --dry-run --ignore-scripts` confirme la cohérence du paquet.

Build Vite réussi, sans avertissement de taille : JS principal **486,31 Ko / gzip 149,45 Ko**. Les nouveaux composants de diffusion sont chargés à la demande ; studio **394,50 Ko / gzip 124,94 Ko** ; CSS **225,88 Ko / gzip 43,12 Ko**. Les compositions Remotion ont été recompilées.

**Rendus réels** : TV paysage **1920 × 1080, 15 s** ; story **1080 × 1920, 15 s**, avec un extrait vidéo réellement décodé ; fond animé **1280 × 720, 10 s** pour l’exemple (l’interface exporte en 1080p). Codec H.264, 24 images/s. Les quatre styles et l’interlude de statistiques ont aussi été rendus en images fixes et inspectés ; le contraste du fondu des statistiques a été corrigé.

**PDF** : quatre fichiers A4 réels (SPA, Éditorial, Liquid glass, Contraste), rendus par Poppler et inspectés. Logo complet de 42 mm sur A4, zone de protection, aucune rotation ni recoloration ; A5 conserve une largeur supérieure à 27 mm. Roboto locale chargée dans le moteur SVG. Le contrôle de dimension physique A4/A5 est également couvert par les tests. Le profil d’exemple est fictif. La mention de scan n’est plus affichée quand aucun QR n’est présent.

**Navigateur** : panneaux Programme/Style/Diffusion, lecture plein écran, portrait story, thème clair et sombre, tags ajoutés sur une photo de test, lecteur sur fiche. Création d’un MP4 depuis l’interface sur la base isolée, fin de rendu avec lien MP4, retrait en corbeille puis restauration du téléchargement. Double titre supprimé ; boutons des vidéos alignés et lecteur contenu dans une carte. La navigation en pause affiche une image visible plutôt que le début transparent d’un fondu.

**Données conservées** : copie de la base fermée dans `work/anipic-demo-pre-v30.sqlite` avant migration. Passage **10 → 11** : **79 animaux, 14 photos, 2 photos à trier, 2 projets vidéo et 3 demandes photo** conservés ; `PRAGMA integrity_check` renvoie `ok`. Couleur `#e97435`, préférences de verre et calendrier existant conservés. Les essais n’ont ajouté ni tag ni vidéo dans cette base principale ; les nouveaux médias d’exemple se trouvent dans `work/signage-v30`.

Limites : aucun déploiement Docker/NAS ni essai sur le téléviseur physique. Les modèles sont implémentés d’après la charte fournie, sans prétendre à une validation officielle de la SPA. Le pilotage matériel des écrans et le mode hors ligne ne sont pas fournis. Aucun service IA externe n’a été appelé pour ces nouveautés. L’archive source exclut comptes de démo, base personnelle, originaux, caches et secrets.

## V2.9 — 16 octobre 2026

**97 tests réussis, 0 échec**, suite complète en 33,5 s. Après l’ultime ajustement des phrases/minutages de sous-titres, les dix scénarios du nouveau module sont repassés avec succès. Tests : véritable callback de lecture automatique du dossier, attente des fichiers stables, absence d’attribution silencieuse, reçus anti-réimport, suggestions avec homonymes, association de dossier après confirmation ; commentaires internes, repères, rôles, résolution et propriété des textes ; marque « publié » interne et filtres ; historique SPA par champ sans doublon sur inventaire identique, pagination/ETag, désactivation et filtrage des métadonnées privées ; affiches A4/A5, dimensions réelles, PNG 300 dpi, ZIP et refus des photos d’un autre animal ; écran public et exclusions ; rapprochements visuels sans mutation des originaux ; SRT, chevauchements, durée du montage ; extraction audio réelle avec FFmpeg et transcription Mistral simulée, accord d’envoi exigé, clé masquée et temporaire retiré.

Build Vite réussi : JS principal **486,79 Ko / gzip 149,21 Ko**, studio chargé séparément **402,12 Ko / gzip 126,54 Ko**, CSS **217,83 Ko / gzip 41,57 Ko**. Composition Remotion recompilée avec sous-titres. `npm ci --dry-run --ignore-scripts` valide la cohérence du lockfile ; l’ajout des dépendances PDF/QR a signalé **0 vulnérabilité npm**. Aucun déploiement Docker/NAS exécuté.

PDF réel : exemple A4 portrait **595,2756 × 841,8898 points**, rendu par Poppler et inspecté. Typographie, badge, marges, description et ententes corrigés puis contrôlés. PNG A4 **2480 × 3508, 300 dpi** ; PDF A5 vérifié aux dimensions **148 × 210 mm**. Exemple entièrement fictif. Le visuel officiel du refuge reste attendu pour adapter ce modèle.

MP4 réel de vérification : **720 × 1280, 7,5 s**, avec deux sous-titres incrustés. L’image intermédiaire a permis de corriger le recouvrement du nom ; la version finale réserve une zone au sous-titre au-dessus du pied de page. Le minutage depuis du texte seul est explicitement estimé. Aucun appel au service Mistral réel n’a été fait sans clé : seul le transport simulé et l’extraction locale ont été validés.

Navigateur : commentaire avec point ajouté dans la démo isolée, affichage du nombre et du texte vérifié ; préparation d’affiche avec aperçu et vrai téléchargement PDF ; réglages de l’écran, masquage de Maya puis diffusion de 7 animaux, photo effectivement chargée ; historique avant/après affiché ; import automatique et ses champs visibles ; texte de voix off saisi et sous-titres éditables générés dans le studio. L’écran et les commandes d’affiche sont contrôlés en format étroit. Les essais de commentaires, sélection et narration n’ajoutent rien dans la base principale.

Migration principale : copie préalable `work/anipic-demo-pre-v29.sqlite`. Passage **v9 → v10** avec **79 animaux, 14 photos, 2 photos à trier, 2 projets et 3 demandes de séance** conservés, aucune erreur de clé étrangère. Les réglages de couleur/verre sont conservés et les tâches automatiques restent désactivées dans l’aperçu local. Le suivi historique démarre avec un état initial explicite ; aucune ancienne description ou adoption n’est inventée.

La transcription authentifiée Mistral, le dossier réel Lightroom/NAS et le navigateur du téléviseur cible restent à raccorder et essayer dans leur environnement. Les réglages de l’écran et de l’import sont désactivés par défaut en production. La release est préparée localement ; aucune publication GitHub distante effectuée.

## V2.8 — 16 octobre 2026

**87 tests réussis, 0 échec**, suite complète en 28,4 s. Nouveaux scénarios : messages internes ciblés par compte/rôle, droits, expiration et lectures individuelles ; corbeille des projets/exports, téléchargements interdits après suppression, restauration, conservation des photos et protection des rendus actifs ; sélection annuelle et décompte d’animaux uniques, statistiques calculées côté serveur sans accepter les chiffres du client, compatibilité des anciens diaporamas et refus des clips dans une mosaïque ; catalogue musical, refus des hôtes/licences/métadonnées invalides, import d’un vrai conteneur audio simulé, auteur/licence et lien d’attribution conservés. Le test de migration vérifie aussi la réouverture d’une base passée en v9.

Réseau réel : recherche Commons HTTP 200 puis import HTTP 201 de **Amazing Plan — Kevin MacLeod, CC BY 3.0**, MP3 de **87,04 s, 3 485 696 octets**, dans une base de test temporaire supprimée à la fin. Recherche depuis l’interface principale également vérifiée, sans import dans la bibliothèque principale. Seuls `commons.wikimedia.org` et `upload.wikimedia.org` sont autorisés pour ce service ; l’autorisation des sources SPA reste distincte.

Rendu Remotion réel : **anipic-bilan-demo.mp4**, **1280 × 720**, **26 s**, **11 272 898 octets**. Huit profils fictifs, portraits/noms successifs, mosaïque dans la silhouette SPA, lettrage puis chiffres. Images intermédiaires et finales inspectées. Trois vues supplémentaires rendues en **720 × 1280** et inspectées pour le format portrait. Les deux adoptions de l’exemple sont des observations fictives dans la base de rendu isolée, pas des statistiques du refuge réel.

Navigateur : sélection annuelle ouverte, Baltic décoché puis montage créé avec Luna seule ; seconde préparation avec deux plans, sans enregistrer de projet dans la base principale. Fenêtres déplacées dans un portail au niveau du document pour éviter le recouvrement par les cartes en verre. Timeline, repères/cases de miniatures et commandes revus. Recherche musicale réelle depuis le studio.

Fonds d’écran : template Tirages photo, texte personnalisé, téléchargement PNG réel relu avec Sharp : **2560 × 1440, sans EXIF**. Le dernier contrôle de composition vérifie aussi le centrage de la dernière rangée et le sélecteur de couleur. Aucun fichier personnel ajouté à la photothèque.

Messages : page administrateur contrôlée sans envoi dans la démo principale. Sur un second serveur de test isolé, connexion en rôle Agent SPA, message affiché à l’accueil, clic sur **Lu** puis disparition de la carte. Menu Configuration absent pour cet agent. Capture conservée avant la lecture ; serveur et onglet de test fermés.

Feuille de séance : **70 lignes**, une seule case Photographié par ligne, **65 références SPA chargées avec succès** dans l’aperçu. Le papier blanc est volontaire. Ni impression physique ni PDF natif produit pour cette version.

Couleurs : rôles, activité, indicateurs et repères utilisent l’accent configuré ; les statuts gardent leur configuration propre. Thèmes clair et sombre parcourus. Propriétés calculées du verre contrôlées : surface de carte à **60 % d’opacité**, flou borné à **12 px** sur les répétitions, saturation **130 %**. Les réglages existants de la démo n’ont pas été réenregistrés.

Contrôles **390 × 844** : fenêtre de téléchargement de 360 px avec trois champs et bouton contenus ; générateur de fonds d’écran sans débordement du document (**375/375 px**), canvas affiché à 309 px ; fenêtre de sélection annuelle de 360 px avec cases et bouton accessibles, largeur interne/scrollWidth **360/360**. Captures relues. La navigation mobile a été parcourue par le menu ouvrable, et le viewport a été rétabli après les essais.

Comparaison avec la copie avant migration : **79 animaux, 14 photos, 2 imports en attente, 2 projets vidéo et 3 demandes photo** conservés, schéma SQLite **8 → 9**. Aucun inventaire SPA appliqué pendant cette passe, aucun projet/export principal supprimé pour les essais. Le planificateur de démo reste désactivé. Une production neuve reste vide ; `.demo` exclu et `DEMO_MODE=false` dans Compose.

Compilations finales : Vite et Remotion réussies. JS principal **458,76 ko / 141,62 ko gzip**, studio différé **393,20 ko / 123,66 ko gzip**, fonds d’écran différé **5,58 ko / 2,65 ko gzip**, CSS **203,94 ko / 39,11 ko gzip**. Aucune dépendance ajoutée. Version et images Compose/Portainer **2.8.0**. Logo SVG/PNG et variante pour fond clair fournis. Description de release et guide préparés ; aucune publication GitHub ni construction/déploiement Docker sur Debian effectués ici.

Captures : `fil-refuge-v28.png`, `fonds-ecran-v28.png`, `studio-bilan-v28.png`, `timeline-v28.png`, `glass-ui-v28.png` et `message-agent-v28.png` dans `docs/images/`. Les limites des services authentifiés Canva/LLM/Mistral et des montages NAS restent celles décrites ci-dessous.

## V2.7 — 16 octobre 2026

**83 tests réussis, 0 échec**, suite complète en 27,3 s. Six nouveaux scénarios couvrent : syntaxe cron, plages/pas/listes et jours combinés ; fuseaux, heure d’hiver, déduplication par minute, mode manuel et source désactivée ; déclenchement par le vrai timer serveur avec horloge simulée et erreur source sans mutation d’animaux ; persistance et validation des réglages glass/priorités/cron avec droits administrateur ; classement SOS/réservés avant pagination, priorité des nouvelles demandes, feuille imprimable et préservation des priorités manuelles ; filtres serveur du fil et exclusion des métadonnées privées.

Navigateur : la flèche de Maya passe de l’image 1/3 à 2/3 avec changement réel de l’URL de photo. Le défilement au survol est activé dans la démo et reste optionnel. La carte SILVER affiche simultanément SOS adoption, À photographier et Source SPA en couleur. Le planning présente les SOS en tête et propose Urgente dans le formulaire, fermé sans créer de demande. Suggestions avec portraits, marges et cases de filtre corrigées. Fil regroupé par date et filtre Adoptions réellement actionné. Preset cron 8/14/20 h et échéances affichés sans enregistrer de planification automatique.

Verre dépoli enregistré côté serveur et conservé après rechargement, propriétés calculées vérifiées. Thème sombre contrôlé sur Synchronisation, Planning et Stockage : pas de panneau d’import blanc, badges cohérents, jauges et légende lisibles. Les panneaux demandés n’existent plus dans le JSX. Le dernier rendu du stockage utilise des surfaces et couleurs du thème, sans estimation.

Comparaison de la base avec la copie de précaution avant cette passe : **79 animaux, 14 photos, 2 imports en attente et 2 projets vidéo** conservés. La base actuelle contient aussi une demande COCOA ajoutée pendant la session ; aucune demande existante n’a été réécrite par les règles. Aucun inventaire source appliqué par les tests, qui utilisent leurs propres bases isolées. Le mode aperçu garde son planificateur désactivé.

Production : inspection du démarrage et de Docker — aucun appel au peuplement, `.demo` exclu de l’image et du ZIP, `DEMO_MODE=false` dans Compose. Un nouveau volume démarre vide. Les animaux SPA déjà synchronisés par l’utilisateur dans la démo restent dans cette base de démonstration.

Compilation finale : JS principal 452,46 ko / 139,80 ko gzip ; studio différé 376,76 ko / 119,60 ko gzip ; éditeur différé 19,20 ko / 7,61 ko gzip ; CSS 186,96 ko / 37,79 ko gzip. Aucune dépendance ajoutée. Sources formatées. Image Compose et version du projet 2.7.0. Déploiement Docker sur Debian non exécuté depuis cette machine Windows.

Captures : `docs/images/cartes-navigation.png`, `priorites-photo.png`, `planification-cron.png`, `stockage-v27.png` et `fil-refuge-v27.png`.

## V2.6.1 — avatar de l’assistant

**77 tests réussis, 0 échec**, suite complète en 31,6 s. Trois scénarios ajoutés : droits administrateur, CSRF/origine ; image publique normalisée, métadonnées retirées, transparence, champ protégé contre l’injection via les réglages, sauvegarde/restauration puis retour au défaut ; refus des fichiers invalides, trop volumineux, trop grands et multiples sans remplacer l’avatar existant. Aucun fichier ajouté à la bibliothèque, au tri ou aux originaux.

Navigateur : choix d’une photo de démonstration, aperçu, application et affichage dans le bouton et le panneau de l’assistant. Le changement conserve un autre réglage du formulaire encore non enregistré. Rechargement avec avatar conservé, puis retour au renard par défaut pour laisser la démo prête à recevoir l’image de l’utilisateur. Bloc de configuration placé sur toute la largeur. Capture : `docs/images/avatar-assistant.png`.

Compilation de production réussie, aucune dépendance ajoutée. Version du projet et image Compose 2.6.1. L’avatar de 512 × 512 px est conservé dans SQLite et inclus dans les sauvegardes existantes ; le remplacement ne crée pas de fichier orphelin.

## V2.6 — retouche et finitions

**74 tests réussis, 0 échec**, suite complète en 22,0 s. Trois nouveaux scénarios vérifient les deux routes de retouche de bibliothèque : refus visiteur/agent/photographe/lecteur, CSRF, original inchangé, variante privée et journal avec ID source ; presets avec intensité sans modification de la géométrie ; effets avancés, centre/bords du vignettage et alpha conservé. Les onze tests ciblés retouche/connecteurs/voix ont aussi été exécutés avec succès.

Navigateur : deux ajustements successifs de vignettage font progresser les aperçus 3 puis 4, valeurs 19 puis 20, sans action d’export. Preset Glamour, mode avancé et recadrage 4:5 manipulés. Export PNG réellement téléchargé et relu avec Sharp : **1 200 × 1 500 px, sans EXIF**. Aucune modification d’original ni nouvelle photo publique pendant ces essais. Les nouvelles variantes serveur sont testées dans une base isolée.

À propos : avatar issu du profil GitHub Gaerisson, servi localement. Relief réellement mesuré en matrix3d, rotations de 2,63° / 3,21° au point testé, amplitude limitée à cinq degrés. Cartes avec appels à l’action, crédits Gaerisson/OpenAI Codex et accès direct au panneau Voix off contrôlés. Nouveau panneau vocal en trois étapes, boutons contenus dans leur cadre. Recherche des deux Nala dans le nouvel assistant en haut, avec identité/espèce conservées.

Contrôles 390 × 844 : À propos et éditeur clientWidth/scrollWidth **375/375**. Assistant corrigé pour rester dans l’écran : largeur 343 px, bord gauche 16 px / bord droit 359 px. Dans l’éditeur, presets puis mode avancé et vignettage réellement actionnés ; panneau de réglages à défilement indépendant, image visible. Captures inspectées et viewport réinitialisé. Les premiers contrôles ont permis de corriger une ancre de popup trop à gauche et une ligne de grille comprimée ; les captures finales correspondent aux corrections.

Compilation finale : JS principal 445,33 ko / 137,29 ko gzip ; studio différé 376,76 ko / 119,60 ko gzip ; éditeur différé 19,20 ko / 7,61 ko gzip ; worker 3,61 ko ; CSS 174,37 ko / 35,50 ko gzip. Aucune nouvelle dépendance. Version du projet et images Compose 2.6.0. Copie SQLite de précaution avant cette passe, comptes, photos et projets préservés.

Release, crédits, capture README et workflow CI préparés. Le workflow utilise les actions officielles checkout/setup-node v7, en lecture seule et sans persistance du jeton Git. Il n’a pas été exécuté sur GitHub. Aucun dépôt distant n’est associé au projet local et aucune publication en ligne n’a été effectuée sans destination fournie. Les limites des services externes et du déploiement ci-dessous restent valables.

## V2.5 — 15 octobre 2026

**71 tests réussis, 0 échec**, suite complète en 23,0 s. Les huit nouveaux scénarios couvrent la lecture directe SPA limitée à sa route exacte, le schéma actuel et l’espèce vide, les ententes avec réserves, le cache de référence sans photo locale, les réglages de pixels/recadrage, la prochaine plage météo contiguë, les droits et la réutilisation des générations Mistral, le mixage résolu voix/musique, l’adaptation des plans fixes, les faits publics transmis au LLM et le lien GitHub limité au domaine attendu.

Réseau réel : réponse HTTP 200 de l’endpoint SPA demandé (42 188 octets sur la première page chiens). Diagnostic complet le 15 octobre à 19:50:11, heure de Paris : **65 fiches, trois passages de 65 avec total annoncé 65, 16 requêtes source, 46,6 s**, aucun échec. Rapport enregistré dans l’administration. C’est un test sans mutation des animaux ; les profils de la démo restent fictifs. Le résultat remplace les constats d’arrêt pour robots des versions précédentes. Mode direct explicitement limité à l’API publique SPA, pacing/DNS/budgets et garde-fous d’archivage conservés.

18 vraies fiches de la première page ont été affichées dans une base de QA isolée, sans photos locales : six aperçus visibles chargés en WebP, image grisée, marque « Photo SPA · aucune photo locale », compteur à zéro. Fiche TESSY contrôlée : femelle, race, ID, âge textuel et « Oui mais ne pourra pas vivre avec » conservés. Aucune date de naissance inventée. La base principale n’a pas reçu ces animaux.

Éditeur : ouverture locale d’une illustration et ouverture d’un original protégé depuis une fiche, réglages, recadrage 4:5. Téléchargement JPEG réel relu avec Sharp : 1 200 × 1 500 px, 296 Ko environ, sans EXIF. Enregistrement par le bouton dans la boîte privée, sans attribution ni remplacement d’original. Historique limité, preview traité dans un worker. La démo garde cette retouche privée à trier en plus de son import Maya existant.

Assistant : recherche « Nala » avec deux résultats distincts Chien/demo:1 et Chat/demo:11, ouverture du bon album, accès à l’éditeur depuis la fiche, page À propos et lien GitHub confirmé. Recherche « recadrer » vers l’éditeur sur téléphone. Aucun appel LLM réel. Les réponses et la configuration serveur sont testées avec un transport simulé ; aucune clé renvoyée au client.

Studio : chargement du projet Nala sans l’enregistrer, préparation locale du brouillon, aperçu Remotion actif. Boutons de génération/catalogue Mistral désactivés en l’absence de clé. `test/render-voice.mjs` a réellement exporté un MP4 **1 280 × 720, 4,011 s, 1 415 331 octets**, avec musique et signal de narration distinct, décalé d’une seconde. Piste audio présente. Les deux sources audio sont synthétiques ; aucune qualité de voix Mistral n’est annoncée comme vérifiée. Le test API simulé contrôle l’appel, la validation du conteneur, les droits, l’audio privé et la réutilisation sans second appel.

Compilations Vite et Remotion réussies. JS principal : 441,51 ko / 136,01 ko gzip ; studio différé : 375,67 ko / 119,39 ko gzip ; éditeur différé : 13,81 ko / 5,66 ko gzip, worker 2,29 ko ; CSS 161,45 ko / 33,20 ko gzip. Aucune dépendance supplémentaire pour la V2.5.

Contrôle à 390 × 844 : éditeur avec photo/recadrage, document clientWidth/scrollWidth 375/375 ; panneau assistant 360 px dans le viewport, pas de débordement. Captures inspectées, override de viewport réinitialisé. Accueil météo/horloge et rapport API contrôlés en affichage normal. Pas d’erreur JavaScript relevée dans le parcours final ; avertissement de licence Remotion attendu. Les projets vidéo enregistrés sont conservés. Copie SQLite de précaution créée avant les changements.

Restent à vérifier : Docker/Portainer, montages NAS, chemin des émissions et services externes authentifiés. Les paragraphes suivants conservent l’historique des validations précédentes.

## Import et séance V2.3

Suite complète : **55 tests réussis, 0 échec** (14,6 s). Cinq nouveaux tests couvrent droits/confidentialité, upload multipart et aperçu réel, déduplication, transaction de lot et homonymes, visibilité préservée, mise à l’écart/restauration, sauvegarde de la boîte en attente, dossier d’exports en lecture seule avec reçus après attribution, réunion des demandes/sans photo et enrichissement des champs source. Les 16 tests ciblés source/connecteur/workflow ont été rejoués après les derniers ajustements : tous réussis.

Migration v7 : tables de tri et reçus. Copie de la base de démo conservée avant migration ; profils, photos et projets existants conservés. Le test de migration des rôles/références couvre la mise à niveau complète jusqu’en v7.

Navigateur : import réel de `Chiens/Nala`, conservation du dossier, import isolé, sélection, recherche des deux Nala, vérification espèce/ID, validation et déduplication réelle. Aucune photo publique ajoutée. Une illustration `DEMO-portrait-Maya.jpg` est laissée dans la boîte privée pour essayer. Feuille : cinq animaux dans l’union, quatre avec le mode sans photo ; aperçu blanc, notes et cases visibles. Aucune impression physique ni PDF natif produit pendant ces essais.

À 390×844 : boîte et feuille clientWidth/scrollWidth 375/375 ; dialogue d’attribution 360 px et document 390/390 lorsque la modale masque le défilement. Captures inspectées ; fenêtre rétablie. Fiche enrichie contrôlée sur un serveur isolé avec données explicitement fictives, sans changer les profils principaux : arrivée/durée, poids, robe, stérilisation, référence, besoins, conditions et ententes affichés.

Les PHP fournis sur Y: ont été relus sans modification ; leurs exports JSON étaient vides. Aucune documentation publique d’API I-CAD trouvée sur les sources officielles, qui décrivent des espaces professionnels. Le collecteur SPA réel reste sans inventaire complet. NAS et I-CAD ne sont pas annoncés comme raccordés.

## Personnalisation et filtres V2.2.2

Deux tests supplémentaires vérifient la sauvegarde/publication des libellés et couleurs sans changer les faits SPA, le refus des réglages invalides et des écritures agents, puis la combinaison statut/photos/espèce/année/archive/pagination. Les photos privées ne font pas apparaître un animal dans « Avec photos » pour un visiteur ; les photos archivées sont exclues. Les valeurs de filtre non reconnues sont refusées.

Suite complète : **50 tests réussis, 0 échec** (12,5 s). Compilation : JS principal 394,81 ko / 121,62 ko gzip ; studio différé 369,23 ko / 117,31 ko gzip ; CSS 131,18 ko / 27,86 ko gzip. Aucun ajout de dépendance. Le module de présentation partagé est copié dans les deux étapes du Dockerfile ; construction Docker toujours non exécutée ici.

Navigateur : enregistrement temporaire « Au refuge » / `#77bfff`, application réelle aux cartes, puis retour à « À l’adoption » / couleur par défaut. Les autres réglages conservés. À largeur identique de 256 px, cartes de 334,34 à 308,5 px, photo inchangée à 190,5 px, corps 92,84 → 72 px. Filtrage réel « À l’adoption + Sans photo » : quatre profils ; combinaison sans résultat, bouton de remise à zéro et retour aux douze profils vérifiés. Les libellés personnalisés restent liés aux valeurs source des filtres.

À 390×844 : clientWidth/scrollWidth 375/375 sur filtres et configuration, champs dans leur panneau ; cartes 163,5×235,13 px, corps 68 px. Captures ordinateur et mobile inspectées. Les badges ont été vérifiés en thèmes Studio nuit et Lumière, puis le thème personnel Studio nuit a été rétabli.

## Correctifs V2.2.1

Trois tests supplémentaires couvrent les libellés français et les indicateurs explicites de statut, la valeur chaîne `false`, les homonymes et le statut des détails historiques, ainsi que la conservation d’une réservation sur les passages paginés. Le diagnostic teste désormais `apiRequested: false` et `stopReason: ROBOTS_DENIED` : Anipic s’arrête avant la requête API, sans conclure à un refus HTTP.

Dans le navigateur, le contour des photos récentes est absent (`display: none`, aucune animation), la bordure reste celle du thème et seul le halo extérieur statique subsiste. Les badges et la légende distinguent disponible / réservé / adopté / absent ; la démo conserve ses données fictives. La grille de téléchargement affiche trois champs de 42 px sur ordinateur et une colonne sur téléphone. Les commandes de timeline mesurent 36×36 px avec icônes centrées. Fenêtre de téléchargement à 390×844 et studio à 375 px de large : aucun débordement horizontal. Captures ordinateur et mobile inspectées. Aucun projet vidéo enregistré n’a été modifié.

Compilation V2.2.1 : JS principal environ 391 ko / 120 ko gzip, studio différé 369,23 ko / 117,31 ko gzip ; CSS 127,90 ko / 27,36 ko gzip. Sources JS/JSX/CSS, serveur, tests, JSON, Markdown et YAML validés par Prettier. Les 11 tests ciblés connecteur/statuts ont été rejoués avec succès après les derniers ajustements du diagnostic. Le rapport visible a été allégé en repliant les explications techniques supplémentaires. La double ponctuation des titres a été corrigée.

Nouveau test réel depuis la démo V2.2.1, le 15 octobre à 01:51:44 (Europe/Paris) : 2,6 s, une requête source, HTML public reçu (2 460 octets, zéro lien animal), `apiRequested: false`, `stopReason: ROBOTS_DENIED`, zéro fiche importée. Le libellé « Arrêt pour robots.txt » et l’explication ont été vérifiés à l’écran ; rapport exporté dans `anipic-diagnostic-spa.json`.

## Présentation courte révisée

La composition active du trailer est passée à une présentation de solution avec l’avant fourni par l’utilisateur et les captures réelles de la démo (accueil, planning, studio). Aucun montage enregistré ni réglage global n’a été modifié pendant les captures. Rendu MP4 complet : 1080×1920, 10,005 s, audio présent, 6 866 866 octets ; contrôle avec `test/check-trailer.mjs`. Les scènes avant/après, photo 3D, pages et conclusion ont été inspectées en images fixes. Voir `PRESENTATION.md` pour la reproduction.

## Tests automatisés

**55 tests réussis, 0 échec.** Commande utilisée :

```sh
node --test --test-concurrency=1 test/*.test.mjs
```

La suite finale a été exécutée avec les processus Node de test habituels. La commande livrée reste `npm test`.

Couverture : comptes/rôles, CSRF, origine, révocation et dernier administrateur ; homonymes et renommage par la source ; déduplication, confidentialité, limites des images et cache ; archives et actions par lot ; imports historiques, collectes partielles et essais multiples ; sauvegarde/restauration avec rejets de fichiers altérés ; marqueurs NAS ; albums privés et visibilité des parents ; exports JPEG/PNG/WebP et ZIP sans thumbnails ; likes idempotents ; notes/priorités préservées lors d’un changement d’état ; immutabilité manuelle des fiches SPA ; RSS/XML, photos du fil et curseurs ; IP/CIDR et refus d’un en-tête de transfert usurpé ; médias vidéo/audio et requêtes Range ; références/durées du film ; formatage Facebook et adaptateurs IA simulés ; météo ; accès privé et confinement du dossier C8.

Le test C8 a aussi été exécuté avec un nom d’émission long et accentué, dépassant la longueur habituelle d’un paramètre de route. La lecture partielle fonctionne. Les émissions MKV ne sont pas annoncées comme lisibles par tous les navigateurs.

## Vérifications V2.2

Huit tests supplémentaires vérifient les paramètres de refuge/endpoint/espèce réellement transmis, les délais/timeouts et budgets, les reprises après une panne HTTP, les filtres sans archivage hors périmètre, les baisses brutales et inventaires anciens, le refus optionnel des imports partiels, le diagnostic sans mutation et les droits admin/CSRF du test avec configuration non enregistrée. Un HTML uniquement JavaScript ne simule pas une collecte réussie. Une panne rend toujours l’inventaire partiel, même si les passages réussis sont identiques.

Essai réel par le bouton API : le 14 octobre à 22:34 (Europe/Paris), une réponse publique reçue, test de 2,6 s, aucun animal reçu/appliqué. Anipic a arrêté la collecte avant l’endpoint JSON à cause de la règle robots.txt ; cette API n’a pas été interrogée. Le rapport distingue les vérifications HTTP/robots/HTML et reste visible après actualisation. Le navigateur sur la page publique de Morée affiche des animaux après JavaScript. Le dernier rapport exporté accompagne la livraison ; les profils de démonstration n’ont pas été remplacés par des fiches supposées.

Navigateur : le preset modifie l’aperçu sans modifier les styles globaux avant sauvegarde ; le carré a été mesuré à `1 / 1`, photo chargée 1200 px. Après sauvegarde, le site applique l’arrondi de 12 px, le tilt de 25 % et le halo de 40 %. Le relief de l’aperçu au déplacement réel de la souris a été mesuré en matrice 3D (environ 1,8°/2,7°). Pages Configuration et API à 390×844 : clientWidth/scrollWidth 375/375, aucune image cassée. Un ancien style qui comprimait le diagnostic en colonnes a été corrigé puis contrôlé visuellement.

Trailer `scripts/render-trailer.mjs` : MP4 rendu entier, 1080×1920, 8 s (8,021 s au niveau du conteneur), 5 977 120 octets, audio présent. `test/check-trailer.mjs` relit et vérifie ces métadonnées. Deux images montrant les orientations opposées de la carte ont été rendues ; la couverture a été inspectée.

Compilation finale : JS principal 389,48 ko / 119,81 ko gzip, studio différé 369,11 ko / 117,29 ko gzip ; CSS 124,40 ko / 26,65 ko gzip. Aucun ajout de dépendance pour cette révision. Les limitations Docker/NAS et IA restent celles indiquées plus bas.

## Vérifications supplémentaires V2.1

Sept tests couvrent la migration v6 sans perte des sessions/références, les droits Agent SPA, les adoptions explicitement observées et leur déduplication, les années de photos/archives et tris, les réglages publics sans modèles/secrets, les exports de publication (1080×1350, 1080×1080, 1080×1920 et aperçu 540×675) et le cadrage des films avec intro/outro optionnelles. Les tests d’export ont été repris après réduction de l’aperçu.

Essais navigateur : enregistrement de Configuration, pages API / Statistiques / Équipe, couleur sombre du centre du donut, zoom par molette puis clic (400 % → 100 %), presets du studio et édition des overlays. À 390×844, accueil/statistiques/outils ont un scrollWidth de 375 pour un clientWidth de 375 : aucun débordement horizontal. Le lecteur C8 a lu une copie du MP4 de présentation dans une base de test isolée : durée 28,011 s, 1080×1920, lecture effective sans erreur, pause, vitesse 1,5× et avance. Aucune émission réelle n’a été ajoutée à votre dossier C8.

`test/render-v21.mjs` : rendu réel du preset minimal/story portrait avec point focal, sans logo ni intro, conclusion de 1,5 s ; MP4 720×1280, 4 s, 1 088 265 octets. Les dimensions/durée ont été relues avec Mediabunny.

`scripts/render-story.mjs` : story complète de présentation, 1080×1920, 28 s (28,011 s avec conteneur/audio), 20 246 201 octets ; piste audio présente. `test/check-story.mjs` vérifie les métadonnées. Aperçus intro/publication inspectés. La musique est une synthèse originale et les images sont des illustrations.

## Rendus vidéo réels de la V2

`test/render-smoke.mjs` a généré deux MP4 entiers :

| Cas                                                                   | Dimensions | Durée | Taille           |
| --------------------------------------------------------------------- | ---------- | ----- | ---------------- |
| Photos + musique WAV, présentation éditoriale, fondu                  | 1280 × 720 | 9,5 s | 3 983 985 octets |
| Clip MP4 importé + photo + musique, bilan annuel, portrait/révélation | 720 × 1280 | 9,5 s | 4 339 128 octets |

Les durées et dimensions ont été relues avec Mediabunny. La piste audio du premier MP4 a été vérifiée ; le second rendu a réellement décodé le clip vidéo du premier. Une image du rendu a été extraite et inspectée : photo, titre, informations, ententes, logo et mise en page.

Un troisième export a été lancé depuis l’interface du studio : projet enregistré, tâche terminée avec état `done`, MP4 1280 × 720 de 12 secondes, aucune erreur de rendu. Les moteurs Linux, les vidéos longues et votre matériel NAS restent à tester sur le serveur cible.

## Migration et sauvegardes

Un ZIP synthétique contenant deux dossiers « Nala », un thumbnail et des dates de 2020 a été testé en simulation, import réel archivé puis reprise. Résultat : deux identités, deux photos privées, une seule copie physique du contenu, thumbnail ignoré, dates conservées, aucun doublon supplémentaire.

Les sauvegardes/restaurations ont également été testées avec une photo d’album privé et un asset audio : confidentialité, références, fichiers et révocation des sessions conservés. La simulation précédente sur le GPIC SPA fourni avait trouvé 0 photo et ignoré 17 616 entrées techniques ; les exports JSON fournis étaient vides.

## Construction

- Compilation Vite et composition Remotion réussies.
- JS principal : 375,85 ko, 115,60 ko gzip. Studio chargé à la demande : 369,11 ko, 117,28 ko gzip.
- CSS : 109,54 ko, 23,83 ko gzip. Photos chargées séparément via les aperçus.
- Audit npm : **0 vulnérabilité connue signalée** au moment du contrôle.
- Sources formatées et fichiers YAML lus par Prettier. Les versions des quatre packages Remotion sont identiques (`4.0.535`).

## Parcours dans le navigateur

- Accueil, thèmes sombre/ambre, cartes : rotation effective mesurée en matrice 3D, reflet actif et retournement, glow visible, boutons de téléchargement présents.
- Fenêtre de téléchargement avec format/taille/cadrage ; album avec photo suivante, zoom à 150 %, miniatures et informations non modifiables.
- Création d’un album privé, import de deux photos via le sélecteur de fichiers et création d’un sous-dossier depuis l’interface.
- Fil du refuge avec portraits et parcours fiche → studio ; réglage du rythme des photos, prévisualisation d’un plan, enregistrement et export MP4.
- Contrôle à 1440 × 1000 et 390 × 844 : menu mobile, pages dans la largeur de l’écran, carrousel et cartes. Aucun dépassement horizontal relevé sur l’accueil mobile.
- Une mise à jour des fichiers compilés pendant les essais avait invalidé un ancien module du studio dans un onglet déjà ouvert. Le serveur prend désormais en compte les nouveaux fichiers et refuse les assets absents sans les remplacer par une page HTML ; l’interface dispose d’un écran de récupération avec actualisation. Le parcours fonctionne avec la compilation finale.
- Le Player Remotion affiche son avertissement de licence prévu. Les conditions d’utilisation du moteur restent à vérifier pour la structure exploitante.

## Limites de vérification

Docker/Portainer et les montages NAS n’ont pas été exécutés ici. Le collecteur et ses réglages ont été testés sur fixtures et son accès réel a été diagnostiqué. Aucun inventaire SPA complet n’a été obtenu : l’endpoint historique est exclu par robots.txt et la page publique reçue côté serveur est une coquille JavaScript. Les services Gemini/Token Harbor ont été testés avec des réponses simulées, sans clé réelle ni dépense. Aucune publication Facebook n’a été effectuée. La page C8 a été testée sur un dossier local isolé, pas sur vos émissions réelles dont le chemin reste à définir.

## Connecteur Canva — V2.4, 15 octobre 2026

63 tests réussis (suite complète), dont huit scénarios Canva : configuration/URLs/chiffrement, PKCE lié au compte et à la session et consommé une seule fois, absence de codes OAuth dans les journaux applicatifs, consentement annulé/incomplet, isolation entre comptes, sélection par ID avec homonymes, export PPTX éditable/JPEG sans EXIF, suivi/lien d’édition, rotation concurrente d’un refresh token, déconnexion, restauration sans jetons/sessions, interruption réseau sans renvoi automatique. Les appels Canva sont simulés ; aucun compte externe n’a été autorisé ni aucune photo envoyée à Canva.

Téléchargement réel via le bouton **Télécharger le PowerPoint** de la fiche fictive Maya : 5 pages, fichier ZIP valide ; les 36 XML/relations ont été analysés sans erreur. Les diapositives contiennent des images et des zones de texte indépendantes, avec recadrage. L’import et les ajustements du rendu dans Canva restent à vérifier sur un compte connecté. L’aperçu local représente la même scène que le générateur PPTX, sans garantir une restitution identique du moteur Canva.

Contrôle navigateur : fenêtre à deux colonnes en 1280×900, boutons d’envoi/téléchargement fixes et contenus dans le dialogue ; version 390×844 sans débordement horizontal (390/390), actions toujours accessibles. Réglages de format/pré-design manipulés ; thème utilisateur conservé et viewport temporaire réinitialisé. Photos, comptes, imports et projets existants conservés, copie SQLite de précaution avant la migration 8.

Compilation : JS principal 430,49 ko / 132,63 ko gzip, studio différé inchangé 369,23 ko / 117,31 ko gzip ; CSS 147,98 ko / 30,79 ko gzip. PptxGenJS 4.0.1 utilisé côté serveur ; image-size forcé en 2.0.4 pour corriger les vulnérabilités de sa dépendance transitive. Audit npm sans vulnérabilité signalée au contrôle.

Configuration réelle restant nécessaire : application Canva Outside Canva, scopes design:content:write et design:meta:read, ID/secret, clé de chiffrement et URL de retour. Secrets exclusivement côté serveur. HTTPS en production et journaux du proxy sans paramètres OAuth. Compose/Portainer documentés et mis à jour ; construction et déploiement Docker/NAS toujours non exécutés ici.
