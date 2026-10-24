# Déploiement AniPic 3.16.1

## Installer sur Debian avec Docker

1. Monter le NAS sur l’hôte du moteur Docker, puis exécuter la préparation sûre décrite ci-dessous. Elle vérifie le partage et les droits avant de créer les dossiers et leurs marqueurs.
2. Copier `.env.example` vers `.env`. Renseigner `ANIPIC_MEDIA_PATH`, `ANIPIC_BACKUP_PATH`, `APP_ORIGIN` et les droits. Les bind mounts utilisent `create_host_path: false`.
3. Démarrer et créer le premier compte :

```sh
docker compose -f compose.yml up -d --build
docker compose -f compose.yml exec -it anipic npm run setup
```

Il n’existe aucun mot de passe par défaut. La saisie de `setup` est masquée. Ouvrir l’URL déclarée dans `APP_ORIGIN`.

La base SQLite et le cache restent dans des volumes Docker locaux. Les originaux, médias vidéo et sauvegardes sont sur le NAS. Une seule instance utilise cette base. Ne pas déplacer SQLite sur un partage SMB/NFS.

L’image prépare le navigateur et la composition Remotion pendant sa construction. Le conteneur tourne sans root, avec système de fichiers en lecture seule, capacités retirées et logs bornés. Prévoir 2 Go de RAM, 2 CPU et le `/tmp` de 512 Mo fournis comme point de départ pour le rendu à une seule tâche ; mesurer ensuite les vidéos longues sur votre matériel. `VIDEO_RENDER_ENABLED=false` désactive les exports sans retirer l’éditeur.

Pour un UID autre que 1000, adapter également les droits des volumes locaux et des dossiers NAS. Si la connexion NAS est interrompue, le marqueur et la vérification de santé signalent son indisponibilité.

## Préparer le stockage NAS

Docker vérifie l’existence des bind mounts avant de lancer AniPic. Cette étape s’effectue donc sur **l’hôte du moteur Docker**, avant le déploiement de la stack. Exemple avec un vrai partage déjà monté sur `/mnt/nas` :

```sh
findmnt -T /mnt/nas
sudo node scripts/prepare-storage.mjs --mount /mnt/nas --root /mnt/nas/anipic --uid 1000 --gid 1000 --with-c8 --with-import
# Contrôle ultérieur sans créer de dossier ni de marqueur :
sudo node scripts/prepare-storage.mjs --mount /mnt/nas --root /mnt/nas/anipic --uid 1000 --gid 1000 --with-c8 --with-import --check
```

Node.js 24 est nécessaire pour ce script. Sans Node sur l’hôte, construire d’abord l’image puis utiliser son runtime, en montant le parent NAS existant :

```sh
docker build -t anipic:3.16.1 .
docker run --rm --read-only --user 1000:1000 \
  --mount type=bind,src=/mnt/nas,dst=/mnt/nas \
  --entrypoint node anipic:3.16.1 scripts/prepare-storage.mjs \
  --mount /mnt/nas --root /mnt/nas/anipic --uid 1000 --gid 1000 --with-c8 --with-import
```

Le script accepte un point de montage NFS/NFS4/CIFS/SMB3 vérifié via `/proc/self/mountinfo`, refuse les liens symboliques et garde un descripteur ouvert sur le système de fichiers validé. Un démontage ne doit pas rediriger ses écritures vers le disque local. Il travaille avec l’UID/GID du conteneur et teste une écriture exclusive avant de créer `.anipic-volume`. Il ne modifie ni les fichiers existants, ni les ACL, ni les propriétaires. Un partage non accessible produit un refus explicite.

`photos` et `backups` sont créés sous la racine choisie. `C8` et `Import` sont facultatifs : retirer leurs options si inutiles. Reporter les variables affichées dans `.env` ou Portainer. Les dossiers doivent être **sur le même hôte que le moteur**, pas sur le PC qui affiche Portainer. Pour des chemins existants en dehors de cette racine, conserver les montages habituels et faire vérifier leurs permissions/marqueurs par l’administrateur du NAS.

Les volumes Compose gardent `create_host_path: false` et `REQUIRE_STORAGE_MARKER=true`. En production, AniPic ne crée pas ses racines NAS à la place de dossiers absents. Le panneau **Stockage → État des dossiers** expose photos/sauvegardes/C8/Import ; **Tester l’accès** ajoute un essai d’écriture temporaire pour les deux dossiers modifiables. C8 et Import restent montés en lecture seule dans l’application. Le journal et `docker compose logs anipic` aident au diagnostic.

Cette préparation est couverte par des simulations de montage absent, permissions refusées et coupure pendant l’initialisation ; elle doit aussi être essayée sur votre NAS. [Contrôles avant release](CONTROLES_RELEASE.md).

## Portainer et Apache

Choisir le mode adapté à la stack existante. `compose.yml` compile le dépôt Git, `portainer-stack.yml` utilise une image locale et `portainer-ghcr.yml` télécharge l’image publiée dans GitHub Container Registry (GHCR). Aucun de ces fichiers ne change les volumes ou les chemins NAS.

### Image GitHub prête à télécharger

Après la réussite du workflow de publication, utiliser `portainer-ghcr.yml` dans la **même stack**. Ce fichier référence `ghcr.io/gaerisson/anipic:3.16.1` avec `pull_policy: always` ; ici, **Re-pull image peut être activé**. Conserver toutes les variables NAS, UID/GID, port, origine et overrides C8/Import.

```sh
docker compose -f portainer-ghcr.yml pull
docker compose -f portainer-ghcr.yml up -d
```

Pour C8 et Import, ajouter les mêmes `-f compose.c8.yml -f compose.import.yml` aux commandes. Conserver le nom de projet existant (au besoin `-p NOM_EXISTANT`) : changer de nom crée d’autres volumes. Ne pas supprimer la stack pour passer d’un mode à l’autre.

`ANIPIC_IMAGE` permet d’épingler une autre version publiée ou le digest fourni dans la release, par exemple `ghcr.io/gaerisson/anipic@sha256:...`. Éviter `latest` pour une installation où la version doit être choisie explicitement. L’image actuelle cible **linux/amd64** ; une machine ARM nécessite sa propre construction et validation.

Au premier envoi sur GHCR, le package peut être privé : son propriétaire doit choisir **Package settings → Change visibility → Public** pour autoriser le téléchargement anonyme. Le dépôt public ne rend pas automatiquement son package public. Vérifier le téléchargement depuis l’hôte Portainer avant la mise à jour. Si l’image/version n’est pas encore publiée, utiliser le mode compilation depuis Git ci-dessous.

### Stack Git sur Docker Standalone

Dans les réglages de la stack **existante**, utiliser `compose.yml` comme chemin Compose, avec les mêmes extensions C8/Import qu’avant. Ce fichier contient `build: .` et `pull_policy: build` : Compose construit l’image depuis le Dockerfile du dépôt et la reconstruit au redéploiement, au lieu de chercher une image AniPic dans un registre.

Récupérer le commit contenant le correctif dans GitHub, puis **Pull and redeploy → Re-pull image and redeploy : désactivé → Update**. Pour GitOps, laisser aussi **Re-pull image** désactivé dans les réglages automatiques. Récupérer le dépôt Git reste nécessaire ; l’option désactivée concerne uniquement le téléchargement d’images Docker.

Ne pas utiliser `portainer-stack.yml` pour une compilation automatique depuis Git : ce fichier ne contient pas de contexte de build. Ne pas ajouter `build: .` dans un simple éditeur Portainer sans fournir les sources du projet.

### Stack avec image préconstruite / éditeur Portainer

Après avoir récupéré les nouveaux fichiers du projet, construire l’image sur **le moteur Docker utilisé par Portainer**, depuis le répertoire contenant le Dockerfile :

```sh
docker build -t anipic:3.16.1 .
docker image inspect anipic:3.16.1 --format '{{.Id}}'
```

Redéployer ensuite la stack existante avec `portainer-stack.yml`, en conservant **Re-pull image désactivé**. Ce fichier garde `pull_policy: never` et exige que l’image existe déjà sur ce moteur. Si Portainer ne construit pas depuis Git, cette procédure permet de préparer l’image sur l’hôte puis de la déployer. Swarm nécessite aussi une image déjà construite, accessible à chacun des nœuds concernés ; un build Compose n’est pas un mécanisme de déploiement Swarm.

Dans tous les cas, conserver le nom de stack/projet, les variables et tous les volumes/montages existants. Ne pas supprimer la stack ni recréer ses volumes pour résoudre une erreur de pull. Le mode GHCR attend une image réellement publiée : un tag Git ou un commit ne crée pas seul une image téléchargeable.

Références : [mise à jour Portainer](https://docs.portainer.io/user/docker/stacks/edit), [politique de construction Docker Compose](https://docs.docker.com/reference/compose-file/services/#pull_policy).

L’écoute est sur `127.0.0.1:8088` par défaut, adaptée à Apache installé sur le même hôte. Pour un accès LAN direct, renseigner `ANIPIC_BIND_IP=0.0.0.0` et `APP_ORIGIN=http://IP_DU_SERVEUR:8088`. Pour HTTPS derrière Apache, utiliser `COOKIE_SECURE=true` et adapter `deploy/apache.conf.example`.

Les restrictions IP portent sur l’adresse de connexion vérifiée. `TRUST_PROXY=false` ignore les en-têtes de transfert fournis par un visiteur. Si nécessaire, activer `TRUST_PROXY=true` et renseigner `PROXY_TRUSTED_IPS` avec les IP/CIDR exacts de votre frontal ; par défaut seuls `127.0.0.1` et `::1` sont approuvés. Dans Docker, l’IP du frontal peut être celle de son réseau Docker. Les restrictions IP complètent le compte et son rôle ; elles ne créent pas une connexion administrateur automatique.

## Configurer Vidéo C8 plus tard

Renseigner `ANIPIC_C8_PATH=/mnt/nas/emissions` dans `.env`, puis utiliser l’override livré :

```sh
docker compose -f compose.yml -f compose.c8.yml up -d
```

Il monte ce dossier sur `/broadcasts`, en lecture seule, et définit `BROADCAST_DIR=/broadcasts`. Dans Portainer, ajouter les mêmes entrées `environment` et `volumes` de `compose.c8.yml` au service de la stack. Sans Docker, `BROADCAST_DIR` prend directement le chemin absolu du dossier.

La page ne lit que les fichiers vidéo à l’intérieur de cette racine. La recherche parcourt au maximum 4 niveaux, 10 000 entrées et 2 000 vidéos. Le catalogue se met à jour après 60 secondes. La lecture permet l’avance/recul via les requêtes Range. L’accès est réservé à l’équipe par défaut ; les paramètres permettent de rendre cette page publique, avec révocation immédiate des lectures. Un PIN global actif reste nécessaire.

Préférer MP4 H.264/AAC ou WebM compatible avec votre navigateur. Les MKV sont répertoriés, mais leur lecture n’est pas garantie ; une conversion préalable peut être nécessaire. Il n’y a pas de transcodage automatique d’émission ni de téléchargement depuis C8. Ce dossier externe ne fait pas partie des sauvegardes Anipic.

## Gemini / Token Harbor

Dans l’environnement du serveur ou les variables de la stack :

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
TOKENHARBOR_API_KEY=
TOKENHARBOR_MODEL=
```

Les champs vides désactivent le service concerné. Choisir pour Token Harbor un identifiant de modèle disponible sur votre compte. L’adaptateur utilise précisément `https://tokenharbor.ai/v1/chat/completions`. Gemini utilise l’API `generateContent`. Les clés restent côté serveur, hors du navigateur, des sauvegardes et de la livraison.

Seuls les faits publics de la fiche sont transmis pour demander un brouillon : aucune note de séance, IP, photo privée ou donnée de compte. Relire le texte avant publication. Le bouton Facebook prépare un texte et un visuel ; il ne publie pas automatiquement sur un compte Facebook.


## Stockage et sauvegardes

Les originaux sont immuables, identifiés par SHA-256 et dédupliqués. Les aperçus WebP de 320/640/1280 px sont générés à la demande, puis évincés sous un budget de cache (512 Mo par défaut). Ils ne figurent pas dans les ZIP ou les sauvegardes. Les conversions JPEG/PNG/WebP sont calculées à la demande sans stocker toutes les variantes.

Archiver retire une photo/fiche de l’affichage courant sans copier ni supprimer son original. La restauration d’un album reste possible depuis Archives. L’espace Stockage mesure les fichiers, le cache, la base, les sauvegardes et les références partagées ; l’estimation du MP4 repose sur le débit cible et reste indicative.

Les sauvegardes contiennent SQLite, les comptes, les originaux, les albums privés, les assets vidéo et les rendus enregistrés. Les clés `.env`, le cache et les émissions C8 externes sont exclus. SHA-256 et intégrité SQLite sont vérifiés. Programmation par défaut : toutes les 24 h, 7 copies réussies conservées. Le conteneur doit fonctionner.

```sh
npm run backup
npm run restore -- /chemin/sauvegarde.tar.gz /nouveau-dossier
```

La destination de restauration doit être nouvelle. Elle contient `data/`, `media/` et le manifest ; les sessions sont révoquées. Arrêter l’instance avant de basculer sur ces nouveaux dossiers/volumes, puis récréer les marqueurs NAS. La sauvegarde contient des données privées et n’est pas chiffrée par Anipic : la conserver dans un stockage privé et organiser aussi une seconde copie hors du NAS. Prévoir de la place pour une copie temporaire si les liens physiques ne sont pas disponibles.


La clé Mistral saisie dans l’interface reste dans le volume SQLite, dans le fichier privé `.mistral-key`. Elle est exclue des sauvegardes et des exports : la renseigner de nouveau après restauration. Les variables d’environnement conservent leur rôle habituel.


## PIN, compte agent du refuge et pages publiques

Tout se règle dans Paramètres → Accès. Créer d’abord un compte Agent SPA actif. Renseigner les IP/CIDR exactes du refuge et choisir ce compte pour la connexion automatique ; aucune attribution du rôle administrateur par IP. Le bouton Changer de compte permet ensuite une connexion personnelle. Les sessions automatiques sont liées à leur réseau d’origine et révoquées quand la configuration change.

Le PIN général est désactivé initialement. Une fois activé, il protège les API et médias, y compris le lecteur TV et les pages rendues publiques. Déverrouiller le navigateur de la TV une fois, ou lui donner une IP autorisée du refuge. L’autorisation PIN n’expire pas côté AniPic ; le cookie persistant est renouvelé pour 400 jours lors des visites et du rafraîchissement TV. Effacer les cookies ou changer le PIN nécessite une nouvelle saisie. Les comptes authentifiés restent utilisables sans saisir ce PIN. Ne pas inscrire le PIN dans une URL ou dans le README.

## GeoIP et visiteurs

DB-IP City Lite est embarquée via le paquet dbip-city-lite ; aucune requête distante avec les IP des visiteurs. Le premier affichage des visiteurs charge environ 121 Mo de base en mémoire. Les IP privées sont marquées réseau local. Pays, ville et région restent approximatifs et peuvent manquer. Attribution : IP Geolocation by DB-IP, base Lite CC BY 4.0.

Pour actualiser la base, charger un fichier City Lite MMDB ou MMDB.GZ dans Paramètres → GeoIP. Il est conservé dans le volume local de la base ; l’ancienne instance en mémoire est remplacée. On peut aussi monter un fichier externe en lecture seule et définir GEOIP_DB_PATH avec son chemin interne au conteneur. Pour ce cas, ajouter explicitement ce bind mount et la variable au compose ; la valeur Windows ou NAS de l’hôte n’est pas un chemin interne au conteneur.

## Mise à jour d’une installation

Créer une sauvegarde vérifiée, conserver l’ancienne image, puis reconstruire avec le nouveau code et redémarrer le service. Le schéma est migré automatiquement vers la version 21 sans reset de données. Garder les mêmes volumes. Vérifier /api/health, ouvrir la galerie et recharger les onglets déjà ouverts pour prendre les nouveaux fichiers frontaux. Une restauration de secours s’effectue toujours dans un nouveau dossier.


## Canva avec PIN global

Configurer une URL de callback exacte, généralement `https://votre-domaine/api/canva/callback`, dans Canva et dans AniPic. La connexion exige une session utilisateur autorisée. Au départ OAuth, AniPic pose un cookie de retour HttpOnly, temporaire (10 minutes), SameSite=Lax et limité à `/api/canva/callback` ; les cookies de session/PIN habituels restent Strict. Au retour, seule cette route GET peut retrouver la session correspondante. Le rôle, l’utilisateur, la session exacte, l’IP si liée au réseau, le `state` à usage unique, PKCE et l’expiration sont toujours contrôlés. Une session expirée doit se reconnecter puis relancer Canva.

En HTTPS, définir `COOKIE_SECURE=true` avec `APP_ORIGIN` et le frontal correctement configurés. Ne pas élargir les routes publiques ni désactiver le PIN pour contourner un échec OAuth. Les journaux excluent les codes et paramètres de callback.


## RAM du détourage dans Portainer

Les fichiers Compose limitent le conteneur à **2 Gio par défaut**, même si la VM a davantage de RAM. Le détourage précis vérifie qu’au moins 3 Gio sont disponibles avant de charger le modèle.

1. Dans Portainer, ouvrir **Stacks → AniPic → variables d’environnement de la stack**.
2. Définir `ANIPIC_MEMORY_LIMIT=4g`. Il s’agit d’une variable substituée par Compose, pas seulement d’une variable ajoutée dans le conteneur.
3. Mettre à jour la stack existante, sans supprimer/recréer les volumes. Si le YAML est personnalisé, la limite équivalente est `mem_limit: 4g`.
4. Vérifier que la VM dispose de cette RAM avec une marge pour son système et ses autres services. Si elle n’a que 4 Gio au total, augmenter d’abord la RAM de la VM ou ajuster les ressources des autres services.

Avec le nom de conteneur réellement affiché dans Portainer, `docker inspect NOM_CONTENEUR --format '{{.HostConfig.Memory}}'` doit indiquer `4294967296` pour 4 Gio. `docker stats --no-stream NOM_CONTENEUR` affiche la consommation et le plafond en cours.

AniPic n’augmente pas la mémoire du NAS ou de la VM et ne désactive pas son contrôle pour lancer le modèle sans marge suffisante. Un modèle plus petit peut consommer moins tout en conservant une partie du fond : il n’est pas activé automatiquement au détriment de la qualité.


## Conservation des sauvegardes

Dans **Configuration → Sauvegardes**, choisir une durée en jours puis enregistrer. `0` désactive la limite d’âge ; le nombre de copies configuré continue de s’appliquer. Le nettoyage est vérifié chaque heure et après une sauvegarde réussie. Le dernier point de restauration ordinaire et les sauvegardes protégeant des originaux restent conservés. La suppression manuelle demande une confirmation et est réservée aux administrateurs ; les sauvegardes protégées ne peuvent pas être supprimées. Le contrôle de stockage est exécuté avant toute suppression.
