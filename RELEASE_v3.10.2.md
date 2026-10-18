# AniPic 3.10.2 — Synchronisation lisible et interface simplifiée

## Synchronisation SPA

L’accueil de l’équipe affiche une alerte si le dernier inventaire complet et fiable diffère des fiches locales, y compris si les nombres sont identiques mais les identifiants diffèrent. Les effectifs, la date du contrôle et les fiches absentes sont présentés avec un accès à la synchronisation pour l’administration. Un contrôle ancien, incomplet ou en échec reste visible. L’état de l’application est relu chaque minute et au retour sur l’onglet, sans interroger le site SPA à chaque affichage. La collecte suit la planification existante.

Une synchronisation sûre actualise immédiatement la présence des animaux, indépendamment des confirmations d’archivage espacées d’au moins 24 heures. Par défaut, une fiche absente passe dans **À vérifier**, sans devenir « Adopté ». La liste actuelle, les suggestions et la TV l’excluent ; ses photos sont conservées. Un inventaire partiel, ancien ou dont la baisse est suspecte ne déclenche pas cette mise à l’écart. Le dernier statut connu reste consultable. Un inventaire antérieur au dernier inventaire fiable est refusé. Les fiches inchangées ne prennent plus artificiellement une nouvelle date de modification à chaque synchronisation.

Le diagnostic compare les fiches locales au flux reçu et rappelle qu’un test ne met aucune fiche à jour. La suppression du site ne confirme pas le motif du départ.

### Adoption automatique, au choix

Dans **API & connexions → Absences et adoptions automatiques**, choisir **Archiver et compter automatiquement comme adoption**, puis enregistrer. Aucune validation manuelle des fiches n’est alors nécessaire : après le nombre configuré d’inventaires complets et fiables, espacés d’au moins 24 heures, AniPic archive l’animal et le compte dans les adoptions des statistiques, de la gazette et des bilans vidéo. Les photos restent conservées. Les archives déjà confirmées pour absence peuvent être reprises lors d’un prochain contrôle admissible.

Le badge **Adopté · automatique**, l’API, le CSV et le journal signalent que ce classement vient de la règle AniPic. Il ne prétend pas que la SPA a publié un statut d’adoption. Un retour de l’animal rétablit son statut source et retire uniquement l’événement d’adoption déduit, avec une trace dans le journal. Un statut explicitement adopté reçu ensuite confirme l’événement sans compter deux fois. Les archives manuelles et fiches en corbeille restent exclues du traitement des absences. Un simple test du connecteur ne déclenche pas ce traitement.

## Usage quotidien

- Actions regroupées dans **Options de la liste**, **Créer & gérer** et **Gérer cette photo** ; réattribution en double retirée et légende repliable. Les menus restent accessibles au clavier.
- Choix de 12, 24, 48, 96 ou 200 animaux par page, mémorisé dans le navigateur. Export CSV de tous les résultats filtrés, sans se limiter à la page visible, avec protection contre les formules Excel.
- Tri explicitement fondé sur la dernière série locale visible. Les fiches avec photos SPA seules viennent ensuite. Les dates privées, supprimées ou archivées ne modifient pas le tri anonyme.
- Halo rétabli en thème clair et en glassmorph, avec distinction **Nouvelle fiche** / **Nouvelle série**. L’intensité reste réglable ; zéro le désactive.
- Pictogramme appareil photo retiré du portrait SPA dans **Ça ressemble à…** ; provenance SPA toujours lisible.

## Archives et corbeille

Une fiche archivée peut être placée dans la corbeille puis restaurée avec ses photos. Une synchronisation ne la ressuscite pas automatiquement. L’administration peut vider la corbeille des photos d’animaux et des archives, globalement ou pour une fiche, avec un traitement en arrière-plan et un indicateur de chargement.

Le vidage crée et vérifie d’abord une sauvegarde protégée. Une panne du NAS ou un échec de sauvegarde bloque la suppression. Les photos nécessaires à des projets/affiches sont conservées ; un original partagé avec un autre animal, album ou média reste stocké. Seuls les originaux devenus inutilisés sont retirés. Les éléments conservés et les erreurs sont signalés. Les traces historiques des fiches restent en base ; restaurer un élément définitivement purgé nécessite la sauvegarde. La corbeille des médias propres aux albums privés reste gérée dans ces albums et n’est pas incluse dans ce vidage.

Aucune nouvelle dépendance, migration de schéma ou modification des montages Docker/NAS. [Validation et limites](VALIDATION.md) · [Archives](docs/ARCHIVES.md) · [API](docs/API_ANIMAUX.md).

© Gaerisson — AniPic.
