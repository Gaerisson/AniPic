# AniPic 3.10.1 — Attribution des photos et suggestions visuelles

Une photo attribuée à la mauvaise fiche peut maintenant être déplacée vers le bon animal, seule ou en sélection. Les originaux, légendes, réglages de confidentialité, commentaires, favoris et références d’albums sont conservés. Les couvertures des deux fiches sont ajustées au besoin. Un doublon, même dans la corbeille de destination, bloque le lot avec un message explicite.

L’attribution depuis **Photos à trier** et la réattribution peuvent être annulées avec **Ctrl+Z** (Cmd+Z sur Mac) ou le bouton **Annuler**. L’historique est limité à la session de navigation, à 30 actions et à 30 minutes pour les attributions. Un rechargement de page ou redémarrage serveur efface cet historique ; la réattribution manuelle reste disponible. L’annulation refuse d’écraser une modification ultérieure ou de supprimer une photo réutilisée depuis.

La case **Photos privées** est désormais **décochée par défaut** à l’attribution. Une réattribution conserve toujours la confidentialité actuelle de chaque photo.

**Ça ressemble à…** propose jusqu’à six fiches en comparant les couleurs et le contraste avec les portraits locaux et les photos du site SPA. Les résultats arrivent progressivement, avec un indicateur de chargement et la provenance de la photo de référence. Il s’agit d’une ressemblance indicative, pas d’une reconnaissance certaine de l’animal. Le choix final reste manuel ; aucune photo n’est envoyée à un service IA externe. Pour les grands lots, quatre photos réparties dans la sélection sont analysées.

Aucune dépendance, migration de base ou modification des montages NAS. Les contrôles CI existants restent requis avant publication de l’image Docker. Voir [la validation](VALIDATION.md) et [le guide d’attribution](IMPORT_PHOTOS.md).

© Gaerisson — AniPic.
