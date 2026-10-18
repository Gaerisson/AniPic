# Vérification avant release

Utiliser Node.js **24** et Docker Engine avec le plugin Compose sur une copie de travail propre. Conserver le nom du projet Compose, les noms des volumes et les chemins NAS lors des mises à jour.

```sh
node --version
npm ci
npm test
npm run build
npm run video:build

# Vérification des configurations, sans démarrer de stack ni créer de dossiers.
export ANIPIC_MEDIA_PATH=/mnt/nas/anipic/photos
export ANIPIC_BACKUP_PATH=/mnt/nas/anipic/backups
export ANIPIC_C8_PATH=/mnt/nas/anipic/C8
export ANIPIC_IMPORT_PATH=/mnt/nas/anipic/Import
docker compose -f compose.yml config --quiet
docker compose -f compose.yml -f compose.c8.yml -f compose.import.yml config --quiet
docker compose -f portainer-stack.yml config --quiet
docker compose -f portainer-ghcr.yml config --quiet
# Vérifie aussi les politiques d’image et les protections des volumes :
node scripts/check-deploy-config.mjs

docker build --pull -t anipic:release-check .
docker run --rm --tmpfs /tmp:size=768m --entrypoint node anipic:release-check scripts/docker-smoke.mjs
```

Ou lancer `npm run verify:release` : mêmes étapes, arrêt au premier échec. Les chemins NAS utilisés pour `config` sont fictifs et ne sont jamais montés. Le conteneur de contrôle n’utilise aucun volume existant ; il crée une base vide et des médias temporaires, rend un vrai MP4, importe cette vidéo dans un album privé, vérifie les droits, la lecture Range, la corbeille et la restauration. Le rapport `release-validation.json` n’est créé qu’après la réussite de **toutes** les étapes ; un ancien rapport est retiré au début. Un moteur Docker absent laisse donc la validation incomplète.

La CI `.github/workflows/ci.yml` contrôle chaque PR, push vers main et tag `v*`. Le job Docker attend la réussite des tests et des deux compilations. Sur un push ordinaire vers main, elle valide sans publier. Sur un tag stable `vX.Y.Z` (identique à `package.json` et au lockfile), ou sur un lancement manuel depuis main avec **publish** coché, un job supplémentaire publie sur GHCR puis crée la release. L’image chargée par ce job est exactement celle construite et testée par le job Docker ; elle n’est pas reconstruite. Les droits de publication sont limités à ce job, jamais aux PR. Dans les règles GitHub du dépôt, imposer les jobs `application` et `docker` avant fusion ; leur activation nécessite les droits du propriétaire du dépôt. Ne qualifier une release de validée qu’après le vert de ces jobs pour **le commit exact du tag**, puis l’essai de mise à jour de votre installation.

## Publier l’image et la release

1. Aligner la version npm, les images des trois fichiers Compose, le label Docker et le fichier `RELEASE_vX.Y.Z.md`. `check-deploy-config.mjs` et `release-metadata.mjs` refusent une incohérence. Régénérer les métadonnées npm avec npm, sans éditer les dépendances transitives.
2. Pousser les fichiers sur main. Dans **Actions → Validation Anipic → Run workflow**, sélectionner main et cocher **publish**. Autre option : pousser le tag stable correspondant.
3. Attendre les jobs `application`, `docker` et `publish`. La publication réutilise l’image contrôlée, vérifie ses labels version/commit et pousse `ghcr.io/gaerisson/anipic:X.Y.Z`, `sha-COMMIT` et `latest` (sans faire reculer la dernière version).
4. La release reste en brouillon si la publication échoue. Une fois l’image et les assets envoyés, elle devient publique avec ZIP des sources, SHA-256 et digest d’image. Un tag d’une autre version ou associé à un autre commit est refusé ; une release déjà publiée sur le même commit est laissée intacte. Ne pas réutiliser un numéro publié pour d’autres changements.
5. Au premier envoi GHCR, vérifier la visibilité **Public** du package et le pull depuis le NAS. Utiliser ensuite `portainer-ghcr.yml` dans la stack existante, en gardant ses volumes et les overrides habituels.

Le ZIP GitHub contient les sources ; ses builds sont réalisés par Docker ou npm à l’installation. Il ne contient aucune base, photo NAS, clé `.env` ou donnée de démo. Les images sont actuellement **linux/amd64**. Une image de contrôle intermédiaire est conservée un jour dans les artefacts Actions, puis expire.

La protection du NAS est vérifiée dans le YAML source et dans la configuration Compose normalisée : certaines versions de Compose omettent `false` dans leur sortie JSON. Cette omission ne vaut pas autorisation de créer des dossiers. Une valeur `true`, un chemin inattendu ou l’absence de `create_host_path: false` dans la source font échouer le contrôle.

## Modifier des dépendances

Modifier les dépendances directes avec npm sous Node 24, par exemple `npm install nom@version`. Versionner `package.json` **et** `package-lock.json`. Ne jamais remplacer à la main une version transitive ou son intégrité dans le lockfile. Vérifier ensuite `npm ci` dans un nouveau checkout et relancer les contrôles ci-dessus. L’autorisation d’installation esbuild est déclarée pour sa version vérifiée ; lors d’un changement, examiner son script puis mettre cette autorisation à jour via npm.

## Dépannage npm

`npm ci` refuse les manifestes incohérents ; ce refus doit faire échouer la CI. Pour `No matching version found`, relever le paquet et la plage, vérifier le registre configuré (`npm config get registry`) et ne pas corriger uniquement le numéro dans le lockfile. Sur une branche de réparation, garder une copie du lockfile, régénérer par npm sous Node 24, examiner le diff et tester une installation propre. Ne pas purger les données de l’application pour corriger des dépendances de build. Les caches npm et volumes SQLite/NAS ont des rôles indépendants.

## Dépannage Docker / Portainer

- `denied` pour `ghcr.io/gaerisson/anipic` : vérifier que le job de publication a réussi, que la version demandée existe et que le package GHCR est public. Utiliser `portainer-ghcr.yml`, pas le nom court Docker Hub `anipic`.

- `pull access denied for anipic` / `Failed to pull images of the stack` : désactiver **Re-pull image**. `compose.yml` compile depuis Git avec `pull_policy: build` ; `portainer-stack.yml` utilise une image locale préconstruite avec `pull_policy: never`. Cette image n’est pas publiée sur Docker Hub. Avec le second fichier, la construire sur le moteur de Portainer (`docker build -t anipic:3.10.1 .`) avant de redéployer. Consulter les [deux procédures](DEPLOIEMENT.md#portainer-et-apache) et conserver le nom de stack et ses volumes. Un `docker login` ne crée pas une image absente du registre.

- `mkdir: File exists` : les chemins d’images de base peuvent déjà exister. Le Dockerfile utilise `mkdir -p` pour `/data`, `/media`, `/cache` et `/backups`.
- `bind source path does not exist` : Docker contrôle les chemins **sur l’hôte du moteur**, avant le démarrage d’AniPic. Exécuter la [préparation NAS](DEPLOIEMENT.md#préparer-le-stockage-nas) sur cet hôte, puis reporter les chemins absolus dans Portainer. L’application ne peut pas créer un bind mount qui l’empêche de démarrer.
- `NAS absent ou montage différent` : remonter le vrai partage NFS/SMB et vérifier son point de montage. Ne pas créer le marqueur dans le répertoire local sous un montage absent.
- `EACCES` / permission refusée : vérifier l’UID/GID effectif et les ACL/export NFS côté NAS. Le script ne change pas les propriétaires existants et n’applique aucun `chmod 777`.
- Après une coupure, consulter Stockage → État des dossiers et Journal. Le démarrage de production refuse les marqueurs manquants ; si l’application ne démarre pas, lire les logs du conteneur et contrôler le montage côté hôte.
- Une image construite localement n’existe que sur ce moteur Docker. Une stack Portainer sur un autre moteur doit disposer de cette image ou la construire. `portainer-stack.yml` utilise une image locale sans téléchargement implicite.

## Mise à jour sans perte de données

Créer une sauvegarde vérifiée, noter l’image/commit actuel et les montages, construire l’image puis redéployer **le même projet Compose** avec ses overrides habituels. Conserver les volumes SQLite/cache et les chemins photos/sauvegardes. Ne pas supprimer/recréer les volumes, ne pas utiliser `down -v` ou `volume prune`. La migration est additive ; revenir à une ancienne application après migration nécessite une restauration cohérente, préparée dans une nouvelle destination, jamais une base remise à zéro.

Contrôler santé, connexion, galerie, upload, sauvegarde et rendu vidéo après mise à jour. Les essais sur NAS réel, panne réelle et Portainer restent nécessaires pour valider l’installation propre à votre hôte.
