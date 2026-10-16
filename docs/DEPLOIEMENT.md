# Déploiement AniPic 3.2

## Installer sur Debian avec Docker

1. Monter le NAS sur l’hôte, puis créer deux dossiers distincts pour les médias et les sauvegardes, accessibles à l’UID/GID du conteneur (1000 par défaut). Créer un fichier vide `.anipic-volume` dans chacun de ces deux dossiers. Ce marqueur évite d’écrire ailleurs lorsque le NAS n’est pas monté.
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

## Portainer et Apache

Construire l’image sur le moteur Docker géré par Portainer :

```sh
docker build -t anipic:3.2.0 .
```

Créer une stack avec `portainer-stack.yml` et définir ses variables d’environnement. Son image est locale (`pull_policy: never`). Pour un moteur distant, publier l’image dans votre registre et adapter le nom et la politique de téléchargement.

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

Le PIN général est désactivé initialement. Une fois activé, il protège les API et médias, y compris le lecteur TV et les pages rendues publiques. Déverrouiller le navigateur de la TV une fois, ou lui donner une IP autorisée du refuge. Le cookie de passage dure trente jours ; changer le PIN le révoque. Les comptes authentifiés restent utilisables sans saisir ce PIN. Ne pas inscrire le PIN dans une URL ou dans le README.

## GeoIP et visiteurs

DB-IP City Lite est embarquée via le paquet dbip-city-lite ; aucune requête distante avec les IP des visiteurs. Le premier affichage des visiteurs charge environ 121 Mo de base en mémoire. Les IP privées sont marquées réseau local. Pays, ville et région restent approximatifs et peuvent manquer. Attribution : IP Geolocation by DB-IP, base Lite CC BY 4.0.

Pour actualiser la base, charger un fichier City Lite MMDB ou MMDB.GZ dans Paramètres → GeoIP. Il est conservé dans le volume local de la base ; l’ancienne instance en mémoire est remplacée. On peut aussi monter un fichier externe en lecture seule et définir GEOIP_DB_PATH avec son chemin interne au conteneur. Pour ce cas, ajouter explicitement ce bind mount et la variable au compose ; la valeur Windows ou NAS de l’hôte n’est pas un chemin interne au conteneur.

## Mise à jour d’une installation

Créer une sauvegarde vérifiée, conserver l’ancienne image, puis reconstruire avec le nouveau code et redémarrer le service. Le schéma passe automatiquement à 14 sans reset de données. Garder les mêmes volumes. Vérifier /api/health, ouvrir la galerie et recharger les onglets déjà ouverts pour prendre les nouveaux fichiers frontaux. Une restauration de secours s’effectue toujours dans un nouveau dossier.
