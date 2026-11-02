# AniPic 3.17.1 — Ouvrir AniPic et télécharger en JPG

- **Ouvrir la fiche dans AniPic** : un bouton orange sur la page partagée retrouve la fiche de l’animal sur votre instance. Pour une photo d’album, **Ouvrir AniPic** ouvre la section Albums.
- **Télécharger la photo (JPG)** : le fichier enregistré est désormais une véritable image JPEG, avec l’extension `.jpg`, pour les photos d’animaux, d’albums et les références SPA.
- **Des téléchargements limités à l’aperçu partagé** : taille maximale de 1 280 pixels de large, sans EXIF ni accès à l’original ; les transparences sont converties sur fond blanc. L’affichage de la page conserve le format WebP.
- **Les mêmes règles d’accès** : la page partagée reste accessible sans compte ni PIN. L’ouverture dans AniPic utilise les règles habituelles du refuge. Expiration, révocation et confidentialité continuent de protéger les pages et les téléchargements.

Voir le [guide du partage](docs/PARTAGE_PUBLIC.md) et les [vérifications](VALIDATION.md). Les 13 tests ciblés de partage, albums et photos SPA passent, ainsi que le build web. La publication attend les contrôles complets GitHub Actions du commit exact : tests, builds web et vidéo, Android, Docker et rendu MP4 réel.

Cette mise à jour concerne le web et le serveur. L’APK native reste en **3.14.0**, avec sa signature existante. Après publication réussie, utiliser `ghcr.io/gaerisson/anipic:3.17.1` dans la stack habituelle en conservant ses volumes, chemins NAS et variables.
