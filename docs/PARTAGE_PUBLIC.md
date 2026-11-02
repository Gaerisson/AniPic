# Partager une fiche ou une photo

Dans la fiche d’un animal, **Copier le lien fiche** crée et copie une page de présentation avec ses informations et ses photos publiques. Dans la barre de la photo ouverte, **Copier le lien photo** partage uniquement la photo sélectionnée. Le bouton est aussi disponible dans la visionneuse des albums pour les photos publiques.

Le destinataire ouvre ce lien directement, sans compte et sans saisir le PIN du site. Il ne reçoit pas d’accès au reste de la photothèque. Le lien est valable **30 jours** ; toute personne qui le possède peut ouvrir l’élément pendant cette période. Il faut utiliser l’adresse de l’instance accessible aux destinataires : `APP_ORIGIN` doit correspondre à son adresse publique. Les liens d’un aperçu sur localhost restent locaux à cet ordinateur.

Le bouton **Ouvrir la fiche dans AniPic** retrouve la fiche de l’animal sur la même instance. Pour une photo d’album, **Ouvrir AniPic** ouvre la section Albums. Cette ouverture dans l’application utilise les règles d’accès habituelles du refuge : le PIN ou la connexion peut être demandé. Le lien partagé continue de donner accès uniquement à sa page publique et à ses images.

**Télécharger la photo (JPG)** enregistre une véritable image JPEG, avec l’extension `.jpg`, y compris pour une référence SPA. L’affichage de la page utilise toujours un aperçu WebP ; le téléchargement JPG reste limité à 1 280 pixels de large au maximum, sans EXIF, avec un fond blanc pour les images transparentes.

## Désactiver un lien

Le menu **Liens fiche** ou **Liens photo** présente les liens actifs et leur expiration. **Désactiver** coupe immédiatement l’accès à la page et à ses images lors des requêtes suivantes. Le créateur peut désactiver ses liens ; un administrateur peut gérer tous les liens de l’élément.

Le dernier lien créé reste affiché dans ce menu, avec un champ sélectionnable et **Voir le partage** pour le prévisualiser. Si la copie automatique échoue, un champ de copie manuelle est également proposé près du bouton.

Recopier le lien dans la même vue réutilise celui qui vient d’être créé. Une nouvelle ouverture de la fiche peut créer un nouveau lien ; les précédents restent visibles dans ce menu jusqu’à leur expiration ou leur désactivation. Chaque compte peut avoir au plus vingt liens actifs par élément.

## Contenu accessible

- Les photos privées, archivées ou supprimées sont exclues. Les photos d’albums sont partageables uniquement si l’album et tous ses parents sont publics.
- Une mise en privé, une suppression, le passage d’un animal à la corbeille, la désactivation du créateur ou la perte de ses droits bloque les liens concernés.
- Les images affichées sont des aperçus WebP et les téléchargements sont en JPG, de 1 280 pixels de large au maximum, sans métadonnées EXIF. Les originaux restent protégés.
- La page publique ne contient pas les commentaires de l’équipe, les tâches, les données internes ou les autres albums. Elle affiche une référence SPA lorsque la fiche ne possède pas de photo publique locale.

Les liens peuvent être créés par les administrateurs, agents, éditeurs et bénévoles validés. Un accès par PIN ou un compte lecteur ne suffit pas à créer un partage. La création reste protégée par la session, le contrôle d’origine et le jeton CSRF. Les jetons des liens sont aléatoires et stockés sous forme de condensat ; ils ne donnent aucun droit de connexion. Les pages sont servies sans mise en cache et demandent aux moteurs de recherche de ne pas les indexer.
