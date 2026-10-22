# AniPic 3.14.1 — Canvas, relecture et interface clarifiée

Cette version reprend les nouveautés de [3.14.0](RELEASE_v3.14.0.md) et les dernières corrections vérifiées dans le navigateur.

- **Canvas** : modèles SPA, verre et saisons ; placement libre, textes, formes, photos SPA/locales, calques, annulation, projets privés ou partagés et exports PNG/JPEG/SVG/JSON. La duplication d’une sélection multiple crée désormais des calques ordinaires qui se sauvegardent et se restaurent correctement. Les limites du document sont vérifiées avant l’ajout d’un élément.
- **SVG autonomes** : les images sont intégrées au fichier exporté. Il conserve ses photos une fois téléchargé, sans dépendre d’un lien vers AniPic.
- **Rédaction & relecture** : éditeur avec mise en forme et corrections soulignées, applicables ou ignorables directement dans le texte. Meilleure gestion des réponses IA vides ou tronquées.
- **Interface** : navigation et réglages regroupés, outils utiles mis en avant, journal filtrable en heure de Paris, notification des demandes bénévoles et visite guidée centrée sur les fiches.
- **Fiabilité** : player TV sans PIN avec médias publics contrôlés, état de connexion et récupération automatique ; bilan annuel avec photos SPA et total d’adoptions modifiable pour un montage ; suppression réelle des fiches purgées après sauvegarde vérifiée.

Le projet comprend l’**APK signée 3.14.0**, compatible avec ce serveur. Ces correctifs concernent le site : ils s’appliquent aussi à Android après mise à jour du serveur, sans nécessiter une nouvelle APK.

Conserver les volumes, les données SQLite et les chemins NAS existants. Pour le détourage précis, `ANIPIC_MEMORY_LIMIT=4g` se règle dans les variables de la stack Portainer, avec suffisamment de RAM dans la VM. La protection mémoire reste active.

Les vérifications et les essais physiques non exécutés sont détaillés dans [VALIDATION.md](VALIDATION.md).
