# AniPic 3.10.3 — Interface corrigée et synchronisation plus réactive

## Interface

- Le badge « Nouvelle fiche » quitte le portrait. La date d’import reste indiquée discrètement dans les informations ; seuls les ajouts de photos locales déclenchent le halo des nouveautés. Les badges sur les portraits sont regroupés sans se superposer.
- **Demander une séance** et **Préparer une publication** retrouvent des boutons directs, près de la création d’affiche de box. Le menu **Autres actions** conserve vidéo, Canva, retouche et archivage, séparés visuellement.
- Les menus utilisent la couche supérieure du navigateur : une carte ou un panneau en verre ne les masque plus. Leur position et leur hauteur suivent l’espace disponible, avec fermeture au clic extérieur et à Échap. Échap ferme le menu sans fermer la fiche.
- Titres, barre supérieure, formulaires Google, demandes bénévoles et textes d’aide revus : marges, cases à cocher, champs sur deux colonnes puis une sur mobile, liens dans le flux du texte. Les actions ne compriment plus les titres.
- Horloge et météo utilisent les mêmes surfaces, bordures, ombres et transparences que les autres cartes en thème sombre. Disposition adaptée aux fenêtres étroites.

## Poster et déploiement

L’erreur `HTTP 500 · ENOENT` de la grande affiche venait du logo recherché dans `public/`, absent de l’image de production. Une lecture commune cherche maintenant les ressources dans `dist/`, avec repli sur `public/` pour le développement. La gazette et les affiches de box utilisent également cette lecture. Une ressource réellement manquante produit un message explicite.

Un test exporte une vraie affiche dans une copie organisée comme la production, sans dossier `public/`. Le contrôle de l’image Docker en CI exporte désormais lui aussi cette affiche, en plus du rendu vidéo existant. Les montages NAS et volumes persistants restent inchangés.

## Synchronisation

**Les trois passages du collecteur appartiennent à une seule synchronisation. Ils ne représentent pas trois jours.** Ils vérifient la stabilité de l’inventaire et ne comptent qu’une confirmation de départ.

La fréquence de synchronisation et l’espacement des confirmations peuvent maintenant descendre à **15 minutes**, avec **deux confirmations minimum**. Le délai de confirmation existant reste conservé (24 h par défaut). Dans **API & connexions**, régler la planification sur **À intervalle régulier**, puis choisir la fréquence ; le délai des départs se règle séparément dans **Absences et adoptions automatiques**. La planification manuelle existante n’est pas changée automatiquement.

Avec trois confirmations espacées de 24 h, le classement peut attendre jusqu’à environ 72 h depuis la dernière confirmation, selon le moment de disparition et la planification. Le formulaire explique ce délai. Les arrivées et modifications sont actualisées à chaque synchronisation, sans attendre les confirmations de départ.

Après une erreur ou une collecte incomplète, une planification active réessaie après 5, 10, 20 puis 30 minutes au maximum. Aucun nouvel essai n’est lancé pendant une synchronisation en cours, ni en mode manuel/désactivé. L’alerte d’accueil reste visible après une collecte partielle.

Les totaux de chaque espèce sont contrôlés séparément ; un manque de chats ne peut plus être compensé par un excès dans une autre catégorie. Un même identifiant dans plusieurs espèces fait refuser l’inventaire. Les erreurs, inventaires partiels, baisses suspectes et réponses anciennes ne confirment toujours aucun départ. Les requêtes demandent la revalidation des caches HTTP.

La liste AniPic se relit discrètement chaque minute lorsqu’elle est visible et au retour sur l’onglet, en conservant les filtres et la page. Cette lecture utilise l’API locale, sans relancer la collecte SPA à chaque ouverture de carte.

[Tests et limites](VALIDATION.md) · [Installation](docs/DEPLOIEMENT.md) · [API](docs/API_ANIMAUX.md)

© Gaerisson — AniPic.
