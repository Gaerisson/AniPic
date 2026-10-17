# Corbeille et compression des archives

## Retirer une photo

Sur une fiche animal, **Supprimer · corbeille** retire la photo des sélections et de la diffusion. Les photos déjà archivées ont aussi un bouton Supprimer. La corbeille de la fiche et celle de la page Archives permettent de restaurer les références. Les fichiers et les liens d’albums sont conservés ; une photo retirée n’est plus proposée dans les albums. Les membres autorisés peuvent encore voir sa miniature dans la corbeille.

Cette action ne libère pas d’espace. Aucune purge automatique des originaux n’a été ajoutée.

## Alléger les photos sur le NAS

Dans **Stockage → Alléger les archives**, choisir la qualité WebP (65–95, 82 par défaut) et le grand côté maximal (1 920, 2 560 ou 3 840 px). **Estimer le gain** analyse jusqu’à 12 fichiers et extrapole le gain au volume éligible ; il s’agit d’une estimation.

Après la confirmation explicite de perte de qualité, **Sauvegarder puis compresser** :

1. Refuse de démarrer pendant un import ou un autre traitement. Suspend les nouvelles modifications et les imports pendant l’optimisation ; la consultation reste disponible.
2. Vérifie les marqueurs et les droits du stockage, puis crée une sauvegarde complète SQLite + médias. Vérifie sa somme SHA-256 et relit tous les fichiers de l’archive en comparant le manifest. Une erreur arrête la compression avant tout remplacement.
3. Compresse uniquement des fichiers utilisés par des photos archivées ou des animaux archivés. Un fichier partagé avec une fiche active, un album privé, la boîte d’import ou un média vidéo reste intact. Un fichier déjà optimisé par AniPic n’est pas recompressé.
4. Écrit et vérifie une nouvelle image WebP. Si elle ne gagne pas au moins 5 %, garde l’original. Sinon, bascule les références photo vers le nouveau hash dans une transaction SQLite, conserve les identifiants de photo et adapte le nom à `.webp`.
5. Supprime l’ancien fichier seulement après la transaction et après une nouvelle vérification du stockage. Un échec de suppression laisse un fichier non référencé, sans casser la photo ; le journal le signale et ne compte pas ce fichier dans l’espace libéré.

Chaque fichier est traité séparément. Une interruption peut laisser une partie des archives déjà optimisée ; les photos suivantes restent originales et une sauvegarde protège celles déjà modifiées. Les nouveaux fichiers utilisent un hash distinct : aucun original existant n’est écrasé.

Le bilan du journal indique le nombre de fichiers, le gain effectif dans **le dossier photos** et l’identifiant de la sauvegarde. Celle-ci est protégée de la rotation automatique. Elle nécessite de l’espace supplémentaire dans **le dossier sauvegardes** ; si les deux dossiers utilisent le même volume NAS, le volume global peut temporairement augmenter. Ne pas supprimer cette sauvegarde manuellement si les originaux doivent rester récupérables.

Le mécanisme de verrouillage suppose une instance AniPic utilisant ce stockage et SQLite. Ne pas lancer plusieurs instances qui écrivent dans la même photothèque. Les contrôles de montage restent obligatoires ; l’outil ne crée aucun dossier de remplacement local ni permission `777`.

## Récupérer les originaux

Télécharger la sauvegarde protégée depuis **Sauvegardes**, puis suivre la [procédure de restauration](../README.md). La commande de restauration exige un dossier de destination nouveau et ne remplace jamais les données existantes. Elle rétablit l’état complet précédant la compression, avec les photos d’origine et leurs métadonnées. Pour ne récupérer que des fichiers particuliers, conserver le manifest de la sauvegarde et intervenir sur une copie restaurée, pas dans les volumes en service.

## Taille des imports vidéo

`MAX_MEDIA_MB=512` fixe la limite par fichier audio/vidéo ; la valeur acceptée va de 1 à 4 096 Mo. Elle est transmise par les deux fichiers Compose principaux. Redéployer l’application après modification. Adapter aussi les limites de requête et de délai du reverse proxy si nécessaire. Une image reste limitée par `MAX_UPLOAD_MB` (25 Mo par défaut).

© 2026 Gaerisson
