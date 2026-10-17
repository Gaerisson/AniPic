# Anipic 2.8 — utilisation

## Interface et logo

Le nouvel emblème reprend l’idée de l’appareil photo GPIC, avec une patte dans l’objectif. Les fichiers se trouvent dans `public/anipic-icon.svg`, `anipic-icon.png` et `anipic-logo.svg`. Le logo SPA reste distinct et appartient à la SPA.

Les accents de l’interface utilisent la couleur choisie dans **Configuration** : cartes de rôles, journal, indicateurs, graphique de stockage et repères des photos. Les couleurs de statut restent celles de votre configuration des statuts.

Le verre dépoli s’applique aux panneaux, cartes, fenêtres et menus. **Configuration → Apparence → Glassmorphism** permet de régler le flou jusqu’à 48 px, l’opacité de 35 à 95 % et la saturation. Les cartes répétées limitent le flou à 12 px pour éviter de multiplier les gros filtres. Le mode reste désactivable et respecte la préférence système de transparence réduite.

Les photos provenant uniquement de la SPA gardent leurs couleurs, leur cadre pointillé et le repère **Source SPA**, avec un appareil photo plus visible. Elles ne comptent pas comme des photos locales. Les fenêtres s’affichent au-dessus des éléments en verre ; les cases des miniatures, téléchargements, images du tri et boutons de timeline ont été réalignés.

Le menu est organisé en **Photos**, **Prise de vue**, **Création**, **Mémoire**, **Le refuge**, **Administration** et **Système**. L’ancien import de photos GPIC est maintenant dans **Système → Import GPIC**, réservé à l’administration.

## Bilan de l’année

Dans **Studio vidéo → Créer le bilan annuel** :

1. Choisir l’année et le rendu **Portraits → logo SPA** ou **Diaporama classique**.
2. Cocher les animaux à inclure. Le catalogue réunit les départs/archives de l’année et les animaux dont une adoption a été observée dans les statuts SPA cette année-là.
3. Créer le montage. Les animaux décochés ne sont pas ajoutés à la timeline.
4. Régler format, durée des portraits, musique, voix et conclusion, puis enregistrer/exporter.

La mosaïque fait apparaître les portraits et noms, puis les images composent l’emblème SPA. La fin affiche les adoptions observées dans l’année, le nombre d’animaux distincts du montage et les chiens/chats sélectionnés. Décocher un portrait ne réduit pas le chiffre d’adoptions de l’année. Un simple archivage n’est jamais compté comme une adoption.

Maximum 100 portraits par montage, 10 minutes. La mosaïque utilise des photos locales ; les animaux sans portrait local restent visibles dans la sélection, mais ne peuvent pas être cochés. Pour inclure des clips vidéo, choisir **Diaporama classique** dans **La présentation → Animation du bilan**. Les anciens projets conservent leur diaporama.

Une démonstration MP4 de 26 secondes a été rendue avec des profils fictifs ; ses chiffres ne représentent pas l’activité réelle du refuge.

## Musique

**Clips & musique → Trouver une musique en ligne** propose une recherche Wikimedia Commons et l’import de MP3/WAV pris en charge, de moins de 25 Mo. Seuls les fichiers marqués CC0, domaine public, CC BY ou CC BY-SA sont proposés. Le nom, l’auteur, la licence et la page source sont conservés.

Après enregistrement d’un projet utilisant un morceau du catalogue, **Crédits musique** télécharge le texte d’attribution avec le lien de licence. Les conditions du morceau restent à respecter. Les liens **Pixabay Music** et **Meta Sound Collection** ouvrent les catalogues officiels ; ils ne prétendent pas importer automatiquement leurs bibliothèques. Une musique autorisée sur une plateforme ne l’est pas nécessairement partout ; Pixabay peut aussi signaler un titre au Content ID.

Recherche et import réel d’un morceau Commons testés. Les téléchargements sont limités à deux domaines fixes, sans redirection vers un hôte arbitraire. Une panne du catalogue ne bloque pas l’import manuel de musique.

## Corbeille du studio

**Supprimer le projet** et l’icône de corbeille d’un export le retirent des listes actives. Le téléchargement d’un export supprimé est arrêté. **Corbeille du studio** permet de restaurer projets et exports. Les photos d’origine ne sont pas touchées.

Un rendu en cours doit être annulé avant suppression. Cette corbeille est restaurable : elle ne purge pas les fichiers et ne libère donc pas immédiatement leur place sur le disque.

## Fonds d’écran

**Création → Fonds d’écran** : sélectionner jusqu’à 24 portraits locaux ou ajouter des images depuis son ordinateur. Choisir Mosaïque, Galerie ou Tirages photo, la couleur, un texte et le logo SPA. Formats Full HD, 1440p, 4K et ultralarge 3440 × 1440. **Télécharger le PNG** produit l’image à la taille choisie.

Les fichiers personnels utilisés ici sont traités dans le navigateur et ne sont pas ajoutés à la photothèque. L’outil utilise les couvertures des albums proposés ; les autres images peuvent être ajoutées depuis l’ordinateur.

## Messages aux agents

**Administration → Messages équipe** : choisir les agents SPA, les photographes, toute l’équipe ou un compte précis, puis le titre, le message et la durée de visibilité (1 à 90 jours). Le message apparaît à l’accueil des destinataires connectés. Chaque personne dispose de son propre bouton **Lu**. L’administrateur voit les lectures et peut retirer le message.

Il s’agit de messages internes à Anipic, sans envoi d’e-mail ni notification système. L’accueil vérifie les nouveaux messages toutes les 30 secondes lorsqu’il est visible.

## Feuille de séance et fil

La feuille imprimable utilise un portrait local lorsqu’il existe, sinon la référence SPA. Elle garde les priorités et les identifiants, avec une seule case **Photographié** par animal. Les filtres, la sélection, les notes et l’impression PDF du navigateur restent disponibles. Le papier blanc est volontaire ; les commandes suivent le thème.

Le fil du refuge affiche désormais des portraits plus grands, espèce/sexe/âge disponibles, un extrait de présentation, la race et l’origine ou le nombre des photos.

## Mise à jour et production

Sauvegarder avant la mise à jour, reconstruire l’image puis garder les mêmes volumes. La migration SQLite v9 ajoute les messages, les crédits musicaux et les marqueurs de corbeille. Elle conserve animaux, photos, comptes et projets ; une base migrée doit être ouverte avec cette version ou une version plus récente.

Un nouveau volume de production démarre vide. Le stockage `.demo` est exclu du paquet et de Docker, et Compose conserve `DEMO_MODE=false`. Le Dockerfile reconstruit l’interface et la composition vidéo. Docker/Portainer et les montages NAS restent à valider sur le serveur cible.

Conception et photographie : [Gaerisson](https://github.com/Gaerisson/). Développement assisté par **OpenAI Codex**.
