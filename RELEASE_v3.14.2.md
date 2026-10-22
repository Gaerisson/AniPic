# AniPic 3.14.2 — Canvas, relecture et interface clarifiée

Cette version rassemble les nouveautés de [3.14.0](RELEASE_v3.14.0.md) et les corrections de l’éditeur vérifiées dans le navigateur.

- **Atelier Canvas** : modèles SPA, verre et saisons ; placement libre, textes, formes, photos SPA/locales, calques, annulation, projets privés ou partagés et exports PNG/JPEG/SVG/JSON. Les ombres du modèle Glass sont désormais acceptées à la sauvegarde. La duplication multiple conserve des calques ordinaires ; les SVG intègrent leurs photos pour rester utilisables hors serveur.
- **Rédaction & relecture** : éditeur avec mise en forme et corrections soulignées, applicables ou ignorables directement dans le texte. Meilleure gestion des réponses IA vides ou tronquées.
- **Interface** : navigation et réglages regroupés, outils utiles mis en avant, journal filtrable en heure de Paris, notification des demandes bénévoles et visite guidée centrée sur les fiches.
- **Fiabilité** : player TV sans PIN avec médias publics contrôlés, état de connexion et récupération automatique ; bilan annuel avec photos SPA et total d’adoptions modifiable pour un montage ; suppression réelle des fiches purgées après sauvegarde vérifiée.

L’**APK signée 3.14.0** reste compatible : ces correctifs web s’appliquent à Android après mise à jour du serveur, sans réinstallation de l’application.

Conserver la stack, les volumes, SQLite et tous les chemins NAS existants. Pour le détourage précis, renseigner `ANIPIC_MEMORY_LIMIT=4g` dans les **variables de la stack Portainer** puis redéployer, avec assez de RAM disponible dans la VM. Ajouter cette variable uniquement à l’environnement du conteneur ne modifie pas sa limite Docker.

Les contrôles exécutés et les limites des essais sont détaillés dans [VALIDATION.md](VALIDATION.md).
