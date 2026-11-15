# AniPic 3.18.0 — Un quotidien photo plus simple

## Trier et comparer

Le nombre de photos à attribuer apparaît dans la navigation. Un clic sur une image du tri ouvre sa grande vue ; les cases servent à sélectionner. Les propositions **Ça ressemble à…** se comparent en grand, côte à côte, avant de choisir l’animal et de valider l’attribution.

Les photos écartées restent restaurables. L’administration peut activer leur suppression après trente jours, avec un délai réglable. Cette option est désactivée au départ ; le nettoyage vérifie une sauvegarde, préserve les références utilisées et les fichiers partagés, et ne touche pas au dossier de dépôt.

## Synchroniser sans se perdre dans les réglages

Le bouton **Synchroniser** de la barre supérieure lance une collecte manuelle pour l’administration et indique son avancement. Le choix **Tous les jours à heure fixe** permet de régler 23:00 et son fuseau sans écrire de cron.

Un profil quotidien propose l’adoption automatique après les contrôles d’absence. Les présences observées de moins de deux heures, seuil réglable, passent en confirmation obligatoire sans compter d’adoption. Ces exceptions restent manuelles même si le mode global change. Le mode confirmation obligatoire est aussi disponible pour tous les départs. Les anciennes fiches sans historique fiable ne reçoivent pas une fausse date de publication.

## Une interface plus lisible

- Photos du refuge et photo SPA seule identifiées en grille et en liste ; raccourcis de filtres mis en avant.
- Fiche animal allégée, outils secondaires repliés, actions mieux espacées et raccourci global Ctrl+Z retiré de cette vue.
- Planning photo compact, avec notes développables ; liste imprimable isolée des menus, notifications et autres éléments de l’application.
- Rédaction/relecture organisée autour du texte de travail et des propositions. Les corrections ignorées restent ignorées et une réponse tardive ne change plus le mauvais animal.
- Fonctions désactivables étendues au registre interne, au tri, au planning photo et à l’agenda ; onglets et API suivent le choix.
- Inscriptions Google en attente mises en évidence dans la barre supérieure de l’administration.

## Audience et WhatsApp

**Consultations anonymes** compte les pages par jour et rubrique sans identifier les personnes, indépendamment du suivi détaillé consenti. Compteurs locaux sur 90 jours, désactivation et opposition disponibles, GPC respecté. Ce total n’est pas un nombre de visiteurs uniques. [Fonctionnement et limites](docs/AUDIENCE_ANONYME.md).

Les liens publics proposent **Préparer dans WhatsApp**. Une [étude des bots et passerelles](docs/WHATSAPP.md) couvre envois au groupe et commandes, avec les prérequis des API officielles et clients non officiels. Aucun numéro ni bot n’est connecté automatiquement.

## Mise à jour

Version web/serveur uniquement ; APK native conservée en **3.14.0**. Après validation et publication, utiliser `ghcr.io/gaerisson/anipic:3.18.0` dans la stack habituelle en gardant ses volumes, chemins NAS et variables.

La publication attend les tests complets, les builds web et vidéo, Android, la construction Docker et un vrai rendu MP4. La validation détaillée et ses limites sont consignées dans [VALIDATION.md](VALIDATION.md). Aucun déploiement NAS n’est effectué par cette publication GitHub.
