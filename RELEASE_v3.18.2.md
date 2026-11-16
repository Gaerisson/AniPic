# AniPic 3.18.2 — Un tri qui se termine vraiment

## Des photos, des actions et de l’espace

Le badge **Photos du refuge** disparaît des cartes : les photos locales gardent leur compteur, les références portent simplement **Photo SPA**. Le bouton d’ouverture de la fiche retrouve de l’espace.

Dans **Photos à trier**, la grande vue sépare la navigation des actions, garde l’aide à distance des boutons et adapte la hauteur de l’image au téléphone. Le nouveau bouton **Télécharger (JPG)** fournit un vrai JPEG sans EXIF, jusqu’à 3200 px. Une erreur de lecture affiche un message sans faux fichier JPG.

Une photo ajoutée directement depuis la fiche d’un animal quitte aussi la file active. La collecte du dossier de dépôt ne réintroduit plus une photo déjà importée ; le dépôt manuel reste disponible pour un choix volontaire de réattribution. La liste, le dossier sélectionné et la page se réconcilient après traitement, y compris au retour dans l’onglet.

## Le dossier de dépôt suit le tri

Après attribution ou mise à l’écart, AniPic retire aussi l’export correspondant du dossier de dépôt serveur. La copie conservée dans AniPic est vérifiée avant suppression : l’annulation d’une attribution et la restauration des photos écartées restent disponibles.

Les fichiers modifiés ou remplacés, les liens symboliques et les fichiers sans reçu d’import sont préservés. Le nettoyage reste borné au dossier configuré et conserve les sous-dossiers. Une capture temporaire journalisée permet la reprise après interruption ; les exports plus récents ne sont pas écrasés.

Si le NAS refuse l’écriture, l’attribution reste enregistrée et la source est conservée. Le message indique le problème ; **Nettoyer le dépôt** permet de réessayer après correction des permissions. Le dernier résultat est visible dans le tri et la configuration de l’import.

## Mise à jour Docker / Portainer

Utiliser `ghcr.io/gaerisson/anipic:3.18.2` en gardant la stack, ses volumes et ses variables. **Adapter aussi l’ancien montage `/imports` en lecture/écriture** : `read_only: false` ou `/imports:rw`, avec les permissions de l’UID/GID du service. Le fichier `compose.import.yml` est mis à jour ; un simple changement d’image ne modifie pas les droits d’une stack existante. Le dépôt doit rester un dossier d’exports dédié, distinct des dossiers internes AniPic. [Procédure](docs/DEPLOIEMENT.md).

La validation de publication couvre les tests complets, les builds web/vidéo, Android, Docker et un rendu MP4 réel. La copie locale de démonstration est conservée et aucun déploiement NAS n’est effectué. Version native et APK maintenues en **3.14.0**.
