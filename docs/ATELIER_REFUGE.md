# Gazette du refuge et suivi des affiches

Ces outils se trouvent dans **Outils de l’équipe → L’atelier du refuge**. Le dernier onglet ouvert est mémorisé par navigateur. La gazette s’ouvre par défaut pour les comptes qui peuvent créer des contenus.

## Composer une gazette

Choisir le mois : **Résumé automatique** présente déjà les animaux et le texte de l’édition. Cliquer sur **Préparer la gazette** suffit pour obtenir l’aperçu et les exports. Le chargement affiche l’avancement et les animaux traités. Les autres rubriques permettent de personnaliser l’édition, sans saisie obligatoire.

Le résumé utilise les mouvements retenus et les rendez-vous, avec le nombre actuel de compagnons présents. La sélection de portraits répartit les animaux entre chiens, chats et NAC, avec les photos locales publiques ou celles du site SPA. Régler le nombre de portraits (6, 12, 18 ou 24), masquer certains animaux ou compléter la sélection dans **À la une**. Les animaux déjà présentés dans les arrivées ou adoptions ne sont pas répétés à la une. Les archives n’entrent pas dans la sélection automatique des compagnons présents.

Les données sont actualisées toutes les 60 secondes et au retour dans l’onglet. Un bouton permet de les actualiser immédiatement. Le résumé se désactive pour écrire son propre édito ; le texte automatique est alors conservé comme point de départ.

### Arrivées et adoptions

Les **arrivées** sont proposées à partir d’une date d’arrivée renseignée dans les métadonnées publiques SPA. Une date de création de fiche AniPic, y compris lors d’un premier import, ne suffit pas. Les nouvelles fiches sans date d’arrivée sont présentées à part, avec un bouton permettant de compléter leur date pour la gazette.

Les **adoptions** proviennent des changements de statut datés, en excluant les simples archivages ou disparitions de la source. La date proposée correspond au premier constat daté du statut adopté ; l’équipe peut la préciser dans la gazette si elle connaît la date réelle. Les anciens statuts adopté sans date ne sont pas attribués arbitrairement au mois en cours.

Chaque mouvement peut être inclus ou masqué, accompagné de quelques mots et d’une photo locale publique ou d’une référence SPA. Il est possible d’ajouter manuellement une arrivée ou une adoption, y compris pour un animal archivé. **Les corrections s’appliquent uniquement à cette édition** : ni les dates SPA, ni les statuts, ni l’historique général des animaux ne sont modifiés.

Les compteurs du document correspondent aux mouvements retenus. Le compteur des animaux à rencontrer décrit la situation actuelle, pas un inventaire historique. Jusqu’à 300 mouvements peuvent figurer dans une édition. Les portraits s’adaptent au nombre d’animaux sur une page ; les rubriques avec peu d’animaux utilisent de grandes photos.

### Dates clés et éditorial

Par défaut, les événements du [nouvel agenda partagé](AGENDA.md), autorisés dans la gazette, sont repris pour le mois de l’édition et le mois suivant. Il est possible de masquer un événement pour cette édition ou de désactiver toute la reprise automatique. Les dates saisies directement dans l’édition restent possibles et ne modifient pas l’agenda commun.

Ajouter les portes ouvertes, collectes, événements, rendez-vous ou autres dates importantes : intitulé, date, heure facultative, lieu et précisions. Les dates futures sont autorisées, même en dehors du mois du bulletin. L’agenda est trié par date et heure. Les trois premières dates apparaissent aussi sur le visuel réseaux.

L’édito, les nouvelles, le mot de l’équipe, la signature et le titre sont modifiables. Trois styles sont disponibles : **SPA clair**, **Éditorial crème** et **Glass fumé**. Les textes longs continuent sur des pages supplémentaires. La rubrique À la une peut accueillir 24 portraits supplémentaires ; un animal déjà dans les mouvements reste dans sa rubrique et n’est pas imprimé une seconde fois.

### Brouillons et reprise

Le travail en cours est mémorisé localement dans ce navigateur. Revenir au mois précédent retrouve ses corrections de mouvements pendant la préparation. **Enregistrer l’édition** crée ou actualise un brouillon partagé avec l’équipe dans SQLite. Les brouillons peuvent être repris, dupliqués ou retirés de la liste ; retirer un brouillon garde son contenu ouvert dans l’éditeur pour permettre de l’enregistrer en copie.

Si le contenu est modifié après génération, les exports sont suspendus jusqu’à une nouvelle préparation. Cela évite de partager une ancienne version en pensant envoyer les dernières corrections.

## Exports et WhatsApp

- **PDF complet** : bulletin multipage en A4 portrait.
- **Visuel réseaux** : une image PNG de 1080 × 1350, avec chiffres, portraits et prochaines dates.
- **Toutes les images · ZIP** : chaque page en JPEG de 1240 × 1754, plus le visuel PNG.
- **Page courante · JPEG** : disponible dans le choix du fichier de partage.

Dans **Partager dans WhatsApp**, choisir le PDF, le visuel ou la page courante. Le fichier est préchargé avant le clic. Si le navigateur accepte le partage de fichiers, **Partager le fichier…** ouvre le menu natif : sélectionner WhatsApp, puis la conversation ou le groupe et confirmer l’envoi.

Ce fonctionnement utilise la [Web Share API](https://www.w3.org/TR/web-share/) et dépend du navigateur, du contexte sécurisé et des applications installées. Sur un accès HTTP au NAS ou un navigateur sans partage de fichiers, les boutons **Télécharger pour WhatsApp** et **Ouvrir WhatsApp** permettent de joindre le document téléchargé. Le texte d’accompagnement peut également être copié. Aucun compte Meta ou WhatsApp Business n’est nécessaire à ce mode de partage. AniPic n’envoie pas automatiquement de message et ne partage pas une adresse privée du serveur à la place du fichier.

Les exports sont privés au compte qui les a générés et à l’administration. Les aperçus expirent après une heure, sont limités en mémoire et sont invalidés au redémarrage du serveur. Télécharger les fichiers pour les conserver ; le brouillon permet de les régénérer. Quitter l’onglet n’arrête pas une préparation en cours et le suivi reprend en revenant dans le même navigateur.

### Photos et disponibilité

Les photos locales publiques sont utilisées en priorité, avec un repli sur les références SPA lorsqu’aucun original public n’est disponible. Les photos marquées privées ne sont jamais utilisées. Si la photo d’un mouvement est indisponible, le document conserve son nom et sa date dans une carte indiquant **Photo indisponible**, et l’interface liste les portraits concernés. Un portrait choisi explicitement à la une doit disposer d’une photo ; sinon la préparation signale l’animal et demande de corriger sa source ou de le retirer.

## Suivi des affiches de box

Après impression ou pose, choisir l’animal, saisir l’emplacement et indiquer **Imprimée** ou **Installée**. Le formulaire est également disponible dans le générateur d’affiche, avec la photo sélectionnée. Plusieurs emplacements peuvent être suivis pour le même animal.

Les changements de photo publique, couverture, URL SPA, informations, ententes ou statut/archivage signalent les affiches **À vérifier**. Une simple synchronisation sans changement ne produit pas d’alerte. Un changement d’octets SPA conservant exactement la même URL n’est pas détecté immédiatement.

**Refaire l’affiche** ouvre le générateur. Après remplacement effectif, **J’ai remplacé cette affiche** actualise sa référence. **Retirée du box** conserve la trace et sort l’affiche de la liste active. Les dates, le compte intervenant et le journal sont conservés ; les modifications concurrentes sont refusées.

## Accès et données

Administration, photographe, agent SPA et bénévole approuvé peuvent composer des gazettes et modifier le suivi des box. Un lecteur connecté peut consulter le suivi des box. Les visiteurs et les navigateurs uniquement autorisés par le PIN n’ont accès à aucun de ces outils.

Les sessions, le PIN et la protection CSRF restent appliqués. Le schéma SQLite passe de **19 à 20** par ajout d’une table d’agenda et de son index. Les nouveaux champs de gazette restent dans les brouillons JSON existants. Les anciens brouillons gardent leurs sélections manuelles ; les options automatiques peuvent être activées depuis le résumé. Les sauvegardes habituelles conservent ces données. Aucun montage ou volume Docker n’est modifié.

L’ancien assistant de tri et le détourage ne sont plus proposés dans le menu. Les copies et décisions déjà enregistrées sont conservées ; l’éditeur photo existant reste accessible à son emplacement habituel.
