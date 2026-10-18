# Corbeille et compression des archives

**Archives** regroupe les animaux partis et leurs albums dans une seule page,
avec dossiers par espèce et année, filtre d’année et accès au bilan annuel.
Les anciens liens « Animaux partis » ouvrent cette page. Un archivage n’est
pas présenté comme une adoption par défaut. L’option **Archiver et compter automatiquement comme adoption**, dans API & connexions, permet ce classement après absences confirmées sur des inventaires fiables et espacés. Le badge et le journal indiquent son origine automatique ; si l’animal revient, son statut et les compteurs sont corrigés.

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
## Supprimer une archive et vider la corbeille

Ouvrir une fiche archivée, puis **Créer & gérer → Supprimer l’archive · corbeille**. La fiche disparaît de la navigation des archives ; ses photos restent stockées et restaurables. Une synchronisation ne réimporte pas une fiche supprimée volontairement. La restauration de cette archive, depuis la corbeille, la remet dans les archives avec ses photos et leur confidentialité d’origine.

La **Corbeille · photos d’animaux et archives** se trouve en haut des Archives et dans la fiche d’un animal pour sa propre corbeille. Les membres autorisés peuvent restaurer. Seule l’administration peut **Vider la corbeille**, en saisissant `VIDER` dans l’interface. Le serveur lance un traitement en arrière-plan : sauvegarde complète, vérification des fichiers et de leur intégrité, puis suppression des photos éligibles. Un indicateur et le journal indiquent l’achèvement ou l’erreur.

La sauvegarde créée avant le vidage est protégée de la rotation automatique. Si le NAS est absent, un marqueur manque ou la sauvegarde échoue, rien n’est supprimé et aucun dossier de remplacement local n’est créé. Une photo encore utilisée par un projet ou une affiche reste dans la corbeille ; un original partagé avec une autre fiche, un album ou un média reste stocké. L’interface signale les éléments conservés. Le gain annoncé concerne le dossier des originaux ; la sauvegarde occupe son propre espace.

Après vidage, restaurer un élément purgé nécessite cette sauvegarde. Les traces historiques des fiches restent en base pour conserver les liens et l’historique. Les médias propres aux albums privés ont leur corbeille dans chaque album ; ils ne sont pas inclus dans ce vidage.
