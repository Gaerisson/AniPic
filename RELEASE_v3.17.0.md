# AniPic 3.17.0 — Partager une fiche ou une photo

- **Copier le lien fiche** depuis la fiche d’un animal : son destinataire ouvre une page avec sa présentation et ses photos publiques, sans compte ni code PIN.
- **Copier le lien photo** depuis la photo ouverte : seule l’image sélectionnée est partagée. Le bouton reste accessible en plein écran et fonctionne aussi pour les photos publiques des albums.
- **Des liens maîtrisés** : validité de 30 jours, date d’expiration visible et désactivation depuis les menus Liens fiche ou Liens photo. Le menu conserve le dernier lien créé pour copie manuelle et prévisualisation.
- **Un accès limité à l’élément partagé** : le reste du site reste protégé. Les photos privées, archivées ou supprimées, les albums à parent privé, les données de l’équipe et les originaux ne sont pas partagés. Les destinataires peuvent télécharger un aperçu WebP sans EXIF, de 1 280 pixels de large au maximum.
- **Des contrôles à chaque ouverture** : expiration, révocation, corbeille et droits du créateur sont revérifiés pour la page et ses images. Le lien ne crée ni session de connexion ni autorisation PIN sur le navigateur destinataire.

La création des liens est réservée aux administrateurs, agents, éditeurs et bénévoles validés. Le [guide du partage](docs/PARTAGE_PUBLIC.md) détaille les droits, les liens actifs et l’adresse publique à configurer dans `APP_ORIGIN`.

Cette mise à jour concerne le web et le serveur. L’APK native reste en **3.14.0**, avec sa signature existante. Après publication réussie, utiliser `ghcr.io/gaerisson/anipic:3.17.0` dans la stack habituelle en conservant ses volumes, chemins NAS et variables.

La suite locale de 325 tests, le build web et les contrôles navigateur sur une base isolée passent. La publication attend aussi les contrôles complets GitHub Actions : tests, builds web et vidéo, Android, image Docker et rendu MP4 réel. Voir [VALIDATION.md](VALIDATION.md).
