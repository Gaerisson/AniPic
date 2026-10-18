# Récupérer les informations des animaux

Deux sources différentes : **l’API du site SPA** fournit les fiches publiées sur le site national ; **l’API AniPic** fournit les animaux déjà synchronisés dans votre installation, les références des photos locales et SPA, et l’historique observé. Pour un écran, un autre outil ou un site associé au refuge, utiliser de préférence AniPic : le collecteur SPA centralise les téléchargements et les normalisations.

## 1. Lire directement le site SPA

Route utilisée par le connecteur :

```text
https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/
```

Exemple pour les chiens de Morée :

```bash
curl --fail --get 'https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/' \
  --data-urlencode 'api=1' \
  --data-urlencode 'establishment=refuge-spa-de-moree-jean-leriche' \
  --data-urlencode 'species=chien' \
  --data-urlencode 'paged=1' \
  --data-urlencode 'seed=1'
```

| Paramètre | Valeur |
| --- | --- |
| `establishment` | Slug du refuge dans son URL SPA |
| `species` | `chien`, `chat` ou `nac` |
| `paged` | Numéro de page, à partir de 1 |
| `seed` | Garder la même valeur pendant un passage paginé |
| `api` | `1`, comme dans le connecteur actuel |

Vérification HTTP réelle lors de cette correction : réponse JSON 200 pour les chiens de Morée, **31 résultats annoncés sur 2 pages**, dont 18 sur la première. Ces nombres décrivent ce relevé et peuvent changer. La réponse observée utilise **`results`**, **`nb_pages`** et **`total`**. Le connecteur accepte aussi les variantes historiques `animals` et `max_num_pages`.

Les fiches observées contiennent notamment `ID`, `name`, `description`, `full_url`, `image`, `imageWebp`, `sex`, `races_label`, `age_number`, `sos` et `establishment`. Ne pas supposer que chaque champ existe sur chaque animal. Les ententes peuvent être dans la description plutôt que dans un objet distinct. L’âge textuel n’est pas une date de naissance.

Exemple Node.js 24 pour lire une page :

```js
const url = new URL('https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/');
url.search = new URLSearchParams({
  api: '1', establishment: 'refuge-spa-de-moree-jean-leriche',
  species: 'chien', paged: '1', seed: '1',
});
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`SPA HTTP ${response.status}`);
const data = await response.json();
const animals = data.results ?? data.animals;
if (!Array.isArray(animals)) throw new Error('Format SPA inattendu');
console.log(animals.map(a => ({
  id: a.ID ?? a.id, nom: a.name, sexe: a.sex,
  race: a.races_label, age: a.age_number,
  photo: a.imageWebp || a.image, fiche: a.full_url,
})));
console.log('Pages :', data.nb_pages ?? data.max_num_pages);
```

Pour un inventaire complet, parcourir toutes les pages pour chaque espèce avec un nombre de requêtes borné, une pause entre les pages et déduplication par ID. Ne pas interroger la SPA à chaque affichage de carte. Le collecteur AniPic possède déjà les budgets, répétitions de contrôle et garde-fous contre un inventaire partiel. Une erreur, une page vide ou une disparition ne confirme pas une adoption.

Cette route est utilisée par le site SPA ; ce guide ne constitue pas un contrat d’API officielle stable. Respecter les conditions d’accès de la SPA. Le mode strict du connecteur tient compte de robots.txt ; un mode de lecture directe ciblé existe dans **API & connexions**. Les exemples ne changent aucun réglage de ce mode et n’importent aucune donnée.

## 2. Lire les animaux dans AniPic

Remplacer `https://anipic.exemple.fr` par l’adresse de votre installation. En local : `http://localhost:3036`. Les routes ci-dessous sont des routes JSON ; ne pas ajouter le `#` de la navigation de l’interface.

```text
GET /api/animals?species=dog&status=available&page=1&limit=60
GET /api/animals?species=cat&sos=yes&dogs=conditional
GET /api/animals?q=spa%3A251579
GET /api/animals?archive=1&year=2026
GET /api/animals/UUID_ANIPIC
```

La liste renvoie `{ items, total, page, pages }`. `limit` est compris entre 1 et 60. Par défaut, la liste ne contient pas les animaux archivés ; `archive=1` sélectionne les archives.

| Filtre | Valeurs principales |
| --- | --- |
| `species` | `all`, `dog`, `cat`, `other` |
| `status` | `all`, `available`, `reserved`, `adopted`, `source_missing` |
| `q` | Nom, texte, identifiant AniPic ou référence source |
| `sos` | `all`, `yes`, `no` |
| `cats`, `dogs`, `children` | `all`, `yes`, `no`, `conditional`, `unknown` |
| `photos` | `all`, `with`, `without` : photos locales visibles par cet appelant |
| `sort` | Par exemple `name`, `recent`, `photo_priority` |
| `archive` | `0` ou `1` |

Exemple sans authentification, si les règles d’accès de l’installation l’autorisent :

```js
const base = 'https://anipic.exemple.fr';
async function read(path) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`AniPic HTTP ${response.status}`);
  return response.json();
}
const first = await read('/api/animals?species=dog&limit=60&page=1');
console.log(first.items.map(a => ({
  id: a.id, referenceSPA: a.source_id, nom: a.name,
  race: a.breed, sexe: a.sex, statut: a.status,
  ententes: a.compatibility, source: a.source_url,
  photoLocale: a.cover_id ? `${base}/media/${a.cover_id}?w=1280` : null,
  photoSPA: a.source_metadata?.thumbnail || null,
  dernierePhoto: a.latest_photo_at,
})));
// Continuer avec page=2 jusqu’à first.pages pour lire toute la liste.
const detail = first.items.length
  ? await read(`/api/animals/${first.items[0].id}`)
  : null;
console.log(detail?.photos); // Photos accessibles à cet appelant.
```

**`id` est un UUID propre à AniPic**, différent de l’ID numérique SPA. `source_id` conserve la référence SPA, généralement préfixée par `spa:`. Conserver cet UUID pour appeler la fiche détaillée. Les ententes gardent leur texte original : ne pas traiter « Oui si… » comme un oui sans réserve. Les champs absents restent absents ou vides.

`photo_count` et `latest_photo_at` concernent les photos locales visibles, pas les simples références SPA. Une référence SPA n’est pas une photo importée sur le NAS. Les originaux et les photos privées demandent une session autorisée ; aucune URL ne leur donne un accès public supplémentaire.

## 3. Authentification et PIN

AniPic utilise actuellement des **sessions avec cookies**, pas de clé API/Bearer générique. Pour un script privé qui doit s’authentifier, créer un compte **Lecteur** dédié et conserver son cookie de session :

```bash
# Remplacer les valeurs d’exemple ; garder ce fichier de cookies privé.
curl --fail --cookie-jar anipic-cookies.txt \
  -H 'Content-Type: application/json' \
  --data '{"name":"api-lecture","password":"MOT_DE_PASSE_DU_COMPTE"}' \
  'https://anipic.exemple.fr/api/login'

curl --fail --cookie anipic-cookies.txt \
  'https://anipic.exemple.fr/api/animals?species=dog&limit=60'
```

Le compte doit exister : cet exemple ne le crée pas. La session de compte expire après 12 heures ; se reconnecter en cas d’expiration. Les restrictions IP du compte restent appliquées. Le PIN global est distinct : une session de compte valide permet l’accès, tandis qu’un navigateur seulement déverrouillé par PIN n’acquiert aucun rôle ni droit aux originaux. Sans compte ni autorisation PIN valide, une installation protégée renvoie `401` avec `code: "SITE_PIN_REQUIRED"`.

Pour une lecture publique protégée seulement par le PIN, `POST /api/gate/unlock` accepte `{"pin":"VOTRE_PIN"}` et renvoie un cookie à conserver. Ne pas exposer ce PIN dans du JavaScript public, une URL ou GitHub. L’autorisation est permanente côté AniPic, tant que le navigateur conserve son cookie ; changer le PIN la révoque.

Les lectures GET n’ont pas besoin de jeton CSRF. Les modifications authentifiées demandent le jeton `user.csrf` obtenu via `/api/session` dans l’en-tête `X-CSRF-Token`, en plus de la session et des droits nécessaires. Ce guide n’effectue aucune modification d’animal.

Pour un autre site web, privilégier un appel depuis son serveur : le catalogue `/api/animals` n’annonce pas de CORS interdomaines. Ne pas publier le mot de passe, le PIN ou les cookies dans une application cliente. `/api/public/changes` propose du CORS pour sa consultation publique sans cookies, sous réserve des règles de publication et du PIN de l’installation.

## 4. Historique, fil et programme TV

```text
GET /api/public/changes?limit=100&after=0
GET /api/public/changes?sourceId=spa%3A251579&baseline=1
GET /api/changes?animalId=UUID_ANIPIC&limit=100
GET /api/feed?latest=1&limit=50
GET /api/public/display
```

- **Changements de champs** : `/api/public/changes` renvoie `items` avec `field`, `before`, `after`, `observed_at` et `seq`. Lorsque `next` n’est pas nul, continuer avec `after=next`. `baseline=1` inclut l’état initial ; le suivi ne reconstitue pas les anciennes valeurs jamais enregistrées. L’administration peut désactiver cette API ; la page Fil du refuge peut aussi être réservée à l’équipe. `/api/changes` exige un compte et fournit l’historique interne accessible à ce compte.
- **Événements du refuge** : `/api/feed` renvoie les arrivées, départs et retours. Pour les événements après un curseur : `?after=SEQ&limit=100`. Un départ de source n’est pas nécessairement une adoption.
- **Programme TV** : `/api/public/display` fournit la sélection et le programme configurés si l’écran du refuge est activé. Ce n’est pas un inventaire de tous les animaux : filtres, exclusions et rotation y sont appliqués.

Les protections de PIN, de compte et de publication restent actives même sur les routes dont le nom contient `public`.
## Liste AniPic, présence source et CSV

La liste applicative `GET /api/animals` accepte `limit=12..200` (entier), `page`, `sort=recent|oldest|name|name_desc|photos|few_photos|photo_priority|arrival|archive` et les filtres habituels. Le tri photo utilise la date d’ajout de la **dernière série locale visible** de chaque animal. Les références SPA n’ont pas de date de prise de vue vérifiée et ne sont pas présentées comme une nouvelle série locale.

`presence=current` est la vue par défaut : elle exclut les fiches absentes du dernier inventaire complet appliqué, sans supprimer leurs photos. `presence=missing` les affiche pour vérification ; `presence=all` les inclut avec les autres. Chaque fiche comporte `source_presence.state` (`present`, `missing` ou `unknown`) et `checkedAt`. Par défaut, une absence conserve le dernier statut connu. Si l’administration active `archiveMissing: true` et `sourceMissingOutcome: "adopted"`, les absences confirmées déclenchent l’archivage avec `status: "adopted"` et `adoption_origin: {kind: "automatic_absence", at, confirmations}`. La règle utilise le seuil et le délai configurés (15 minutes minimum, 24 h par défaut), exclusivement sur les inventaires sûrs. Ces adoptions alimentent les statistiques ; un retour corrige automatiquement le statut et l’événement déduit. Le mode `sourceMissingOutcome: "unconfirmed"` conserve l’archivage sans adoption. `sourceMissingTotal` compte les fiches à vérifier dans les filtres demandés.

Pour un compte connecté, `GET /api/animals?format=csv&presence=all` télécharge tous les résultats correspondant aux filtres (jusqu’à 5 000), indépendamment de `page` et `limit`. CSV UTF-8 avec BOM, séparateur point-virgule, guillemets et protection des valeurs pouvant être interprétées comme des formules Excel. Les règles de visibilité du compte s’appliquent aussi aux nombres et dates des photos. Une colonne indique l’origine des adoptions automatiques.

`GET /api/source/health` est réservé aux comptes d’équipe approuvés. Il expose l’état `ok`, `mismatch`, `stale`, `error`, `unverified` ou `disabled`, les effectifs comparés, la date du contrôle, les nombres de fiches absentes/nouvelles et un extrait des fiches à vérifier. Il ne contacte pas la SPA : il compare les données au dernier diagnostic fiable ou inventaire appliqué du refuge configuré. L’accueil le relit chaque minute et au retour sur l’onglet. Il faut utiliser la synchronisation planifiée ou lancer un diagnostic pour obtenir de nouvelles observations du site SPA.

## Fréquence et confirmations

La planification peut utiliser `syncIntervalHours: 0.25` (15 minutes) ; zéro conserve le fonctionnement manuel. `sourceAbsenceIntervalHours: 0.25` règle séparément l’espacement minimum des confirmations de départ, et `missingThreshold` reste au moins égal à 2. Les trois passages de collecte contrôlent un même inventaire et ne remplacent pas ces confirmations espacées.

Les planifications actives réessaient les échecs et collectes partielles avec un délai progressif de 5 à 30 minutes. Les modes manuel et désactivé ne font aucun nouvel essai automatique. Les totaux par espèce et les identifiants entre espèces sont vérifiés avant de valider les absences. La liste web relit l’API AniPic chaque minute lorsqu’elle est visible ; elle ne déclenche pas pour autant une nouvelle collecte SPA.

## Validation des adoptions par l’équipe

`GET /api/adoption-reviews?page=1` renvoie `items`, `total`, `page` et `pages`, à raison de 40 fiches par page. `?countOnly=1` fournit seulement le compteur. Ces routes exigent un compte **agent ou admin** : ni le PIN seul ni un compte bénévole ne permettent d’y accéder.

`POST /api/adoption-reviews/UUID/confirm` accepte `{"expectedAt":"DATE_AT_REÇUE_DANS_LA_LISTE"}` avec session, origine et jeton CSRF. La validation est idempotente ; une fiche revenue dans l’inventaire, retirée de la file ou remplacée par une nouvelle détection produit `409`. Elle ne rajoute aucun événement statistique d’adoption.

Le champ public `adoption_origin.kind` vaut `automatic_absence` pour une déduction non vérifiée et `team_confirmed` après validation. Il expose la date de validation, jamais l’identité du membre de l’équipe. Le journal privé conserve l’auteur. Le fil conserve aussi l’origine des nouveaux événements ; une adoption automatique rétractée est signalée par `automatic_reversed`.
