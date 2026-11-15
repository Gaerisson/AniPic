# AniPic 3.18 — parcours photo et administration simplifiés

Demande : améliorer les parcours quotidiens, corriger les défauts signalés et publier une nouvelle release GitHub. La publication est autorisée ; le déploiement NAS ne fait pas partie de cette demande.

## Approche retenue pour la réalisation

Améliorer les composants et API existants, avec des actions principales visibles et des outils secondaires repliés. Une réécriture complète de la navigation et un nouvel éditeur ne sont pas nécessaires : les défauts identifiés proviennent surtout de contrôles cachés, de la densité des actions et d’états mal suivis. Conserver les permissions, données, originaux et modules existants. Aucune mise à jour de dépendance ou de version Android incidente.

## Tri et comparaison des photos

- Compteur global des photos non écartées dans la navigation et les onglets de l’équipe, actualisé au retour sur la page et après les opérations.
- Le clic sur l’image ouvre la grande vue ; un contrôle distinct sélectionne la photo. Navigation précédent/suivant et fermeture clavier.
- Les suggestions restent des aides visuelles. Comparaison grande de la photo source et de la référence locale/SPA, puis choix explicite de l’animal et validation finale distincte. Nom et ID restent visibles, y compris pour les homonymes.
- Les photos écartées restent restaurables. La conservation est expliquée. La purge facultative après trente jours a été confirmée par l’utilisateur et doit conserver les protections de sauvegarde, de références créatives et de blobs partagés ; aucune activation automatique destructive.

## Synchronisation et adoptions

- Réglage quotidien explicite avec heure et fuseau, dont 23:00 Europe/Paris ; modes intervalle et cron avancé conservés.
- Mode simple proposé : adoption automatique après les vérifications d’absence d’un inventaire complet. Confirmation obligatoire disponible en option et pour les présences courtes/incertaines, sans comptage préalable.
- Seuil proposé : deux heures, réglable. La décision conserve sa raison et son obligation de confirmation ; aucun changement de réglage global ni minuterie ne doit confirmer ces exceptions automatiquement.
- Suivre les observations positives par épisode et figer leur durée avant les jours d’attente d’absence. Ne pas inventer une date de publication pour les anciennes fiches. Un passage quotidien ne permet pas de connaître la durée réelle entre deux collectes ; l’interface doit parler de durée observée.
- Inventaires partiels/suspects/périmés et réapparitions gardent leurs protections actuelles.

## Lisibilité générale

- Différencier explicitement photos locales et photo SPA seule, en grille et en liste. Ajouter des raccourcis de filtrage compréhensibles et un bouton Filtres visible, avec son nombre de critères actifs.
- Fiche animal : retirer le bouton d’annulation global ambigu, regrouper les outils secondaires et séparer les actions sur la photo des actions sur la fiche. Garder accessibles téléchargement et partage.
- Espacer les groupes de boutons, conserver les focus clavier et les dispositions mobiles.
- Planning photo compact avec lignes lisibles et détails repliables ; conserver les opérations existantes.
- Impression : seule la feuille imprimable apparaît, sans onglets, notifications, compte, cookies ou bandeaux de l’application.

## Rédaction et relecture

- Trois zones : animal choisi, texte de travail, proposition/corrections. Actions près du texte et options secondaires repliées.
- Identités de corrections stables ; une correction ignorée reste ignorée après déplacement des positions. Toute édition manuelle qui touche une correction l’invalide ; Tout appliquer applique seulement les corrections encore ouvertes.
- Les réponses asynchrones appartiennent au contexte de génération initial. Changement d’animal, nouvel animal ou onglet invalide l’ancienne demande, y compris ses erreurs et indicateurs de chargement.
- Historique identifiable et reprise explicite ; aucune prétention de sauvegarde d’un texte final non enregistré.

## Fonctions et demandes Google

- Étendre les cases de modules, notamment au registre interne, et appliquer le choix à la navigation, aux onglets et aux API concernées. Les données sont conservées.
- Mettre en évidence les demandes Google en attente pour les administrateurs, avec compteur et accès direct à leur examen, sans notifier les rôles non autorisés.

## Audience et WhatsApp

- Préférer un comptage local agrégé des consultations par date et catégorie, activable indépendamment du suivi détaillé : aucun identifiant de session, IP, compte, agent utilisateur, parcours individuel ou URL contenant un jeton n’entre dans ces agrégats. Ce compteur ne mesure pas des visiteurs uniques.
- Le suivi détaillé existant demeure soumis au consentement et à GPC. Informer dans la confidentialité, proposer désactivation/opposition et une rétention bornée. Documenter le fonctionnement sans prétendre à une certification CNIL.
- Recherche WhatsApp à partir des sources officielles et des projets primaires. Documenter les options pratiques selon le besoin groupe/commandes de l’utilisateur ; aucun message envoyé, compte créé ou numéro connecté dans ce chantier sans configuration explicite.

## Validation et publication

Tests de comportement ciblés, puis suite complète après intégration, builds web/vidéo et vérification de l’APK distribuée. Contrôle visuel et impression si le navigateur est disponible, limites explicitement consignées sinon. Publication d’une nouvelle version web, documentation et release en français ; validation CI complète, Docker avec MP4, tag exact, assets et digest GHCR public avant d’annoncer la fin.
