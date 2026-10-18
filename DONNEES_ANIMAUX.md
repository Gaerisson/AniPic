# Données des animaux et accès aux sources

Vérification du 15 octobre 2026. Les informations des animaux restent issues de la source ; aucun formulaire de modification manuelle des faits n’a été ajouté.

Pour les routes actuelles, les exemples de requêtes et l’authentification, voir le [guide API SPA / AniPic](docs/API_ANIMAUX.md), complété avec une réponse SPA réelle lors de la correction 3.5.4.

## SPA

L’ancienne API fournie utilise `https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/`. Ses fichiers PHP ont été relus, sans modification. Les exports JSON présents dans `SPA_API/data` étaient vides. Le mode strict d’Anipic s’arrête avant cette route exclue par [robots.txt](https://www.la-spa.fr/robots.txt). La V2.5 propose aussi un mode explicite de lecture directe, limité à cet endpoint public. Le test réel du 15 octobre 2026 à 19:50 a reçu 65 fiches sur trois passages identiques, sans importer les animaux dans la démo. Voir le rapport dans API & connexions et [le guide V2.5](docs/history/NOUVEAUTES_V25.md).

Le schéma actuel est reconnu : `ID`, `name`, `description`, `full_url`, `image`, `sex`, `races_label`, `age_number` et établissement. L’âge textuel de la SPA est conservé sans créer une fausse date de naissance. Les ententes avec réserves sont affichées intégralement. La photo source est une référence signalée et mise en cache, jamais comptée comme une photo locale.

Les adaptateurs reprennent les champs historiques : race, sexe, naissance, taille, description et ententes explicitement libellées dans la description. Les libellés HTML `{rendered: ...}`, dates ISO et français, booléens explicites et réservation entre parenthèses dans un titre CMS sont reconnus. Une mention ambiguë dans un texte libre n’est pas transformée en entente ou adoption.

Les données suivantes sont également reconnues **si le flux les fournit** : arrivée au refuge (`arrivalDate`, `arrival_date`, `date_arrivee`, `date_entree`, `admission_date`), poids (`weight`, `poids`, `weightKg`), robe/couleur, stérilisation, référence SPA, besoins spécifiques et conditions d’adoption. Les champs manquants sont omis. Aucun poids ni besoin médical n’est déduit d’une photo ou d’un nom. Par défaut, une absence du site ne devient pas une adoption. L’administration peut activer la règle d’adoption automatique après absences confirmées ; la provenance est conservée, sans présenter ce classement comme un statut explicite publié par la SPA. Le nombre de jours au refuge est calculé seulement à partir d’une date d’arrivée fournie ; la date de création de la fiche dans Anipic n’est pas utilisée comme date d’entrée.

La fiche indique la source et sa dernière observation. Les champs de métadonnées publics sont limités à une liste explicite : des coordonnées de détenteur, jetons ou numéros d’identification ajoutés arbitrairement dans un export ne sont pas publiés par l’API des animaux. Les tests d’enrichissement et l’aperçu technique utilisent des données synthétiques clairement signalées.

## I-CAD

**Aucune API publique documentée trouvée** pendant la recherche sur les sources officielles. Cela ne prouve pas l’absence d’un accès contractuel ou partenaire.

La [documentation I-CAD pour les acteurs de la filière](https://www.i-cad.fr/articles/16) décrit la recherche d’identification et la liste des animaux depuis un espace professionnel réservé. La [FAQ vétérinaire](https://www.i-cad.fr/articles/8) décrit également des fonctions accessibles dans un compte et des restrictions selon les habilitations.

Anipic n’interroge pas I-CAD, ne stocke aucun identifiant I-CAD et n’affiche pas de faux bouton de connexion. Un raccordement futur demande une documentation officielle d’interface et les droits du refuge correspondants. Les coordonnées des détenteurs ne sont pas nécessaires à la photothèque.
