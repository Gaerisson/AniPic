# AniPic 3.11.1 — Installation Android intégrée et accueil du refuge

La page `/android` permet de télécharger l’APK signée directement depuis AniPic. Elle regroupe les instructions, la version, le poids du fichier, son empreinte, le certificat et un QR code vers la page sur téléphone. Accessible depuis le pied de page et l’accueil mobile. Le même dépôt contient le site, les sources Android et l’APK publique, désormais aussi incluse dans l’image Docker et le ZIP source. Les clés privées restent hors du projet.

Cette livraison inclut les corrections web 3.11.0 : météo compacte à côté de l’horloge, effectifs chiens/chats/NAC avec progression des portraits locaux, photos dans le fil et validation directe des adoptions par les agents. Les références SPA restent distinctes des portraits de l’équipe. Confirmation automatique ou après 24 h sans réponse, historique, refus, annulation et rétablissement des décisions, sans double comptage ni perte de photo. Les réglages existants sont conservés.

Les mises à jour du site restent disponibles dans l’app sans nouvelle APK à chaque changement web. L’APK est toujours la version native 3.11.0, signée avec le même certificat. Son téléchargement vérifie la taille et le SHA-256 ; la CI Android vérifie aussi sa signature cryptographique et le certificat du domaine. Les données du refuge restent protégées par le PIN et les droits habituels.

Tests et vérifications détaillés dans [VALIDATION.md](VALIDATION.md). Installation/déploiement : [guide Android](docs/ANDROID.md). Aucun déploiement distant ni publication GitHub effectué ici. Les essais sur téléphone et le build Docker local restent à effectuer.

© Gaerisson · AniPic
