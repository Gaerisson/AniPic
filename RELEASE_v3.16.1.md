# AniPic 3.16.1 — Photos SPA et visiteurs

- **Photos SPA** : une indisponibilité temporaire ne provoque plus une erreur de format Fastify HTTP 500. Le serveur renvoie une erreur temporaire sans mise en cache ; l’interface peut reprendre automatiquement le chargement quand la source répond à nouveau.
- **Visiteurs à jour** : le tableau s’actualise toutes les 15 secondes lorsqu’il est visible, ainsi qu’au retour sur l’onglet. La date de dernière réponse et la durée de conservation configurée sont affichées.
- **Suivi compréhensible** : un encart précise si les statistiques sont désactivées, si ce navigateur n’a pas accepté leur collecte ou si son signal GPC la bloque. Les statistiques restent facultatives, y compris pour les comptes connectés.
- **Comptes et retours sur le site** : une connexion juste après une consultation anonyme apparaît désormais avec le compte. Les consultations consenties reprennent au retour sur un onglet ou après reconnexion réseau, sans ajouter de pages vues pendant l’inactivité.

Cette mise à jour concerne le web et le serveur. L’APK native reste en **3.14.0**, avec son fichier et sa signature existants. Conserver la stack habituelle, les volumes, les chemins NAS et les variables lors de la mise à jour. Image : `ghcr.io/gaerisson/anipic:3.16.1` après publication réussie.

Les 27 tests ciblés, le build web et les contrôles navigateur sur données isolées sont réussis. La publication attend aussi les contrôles complets GitHub Actions : tests, builds web et vidéo, Android, image Docker et rendu MP4 réel. Voir [VALIDATION.md](VALIDATION.md).
