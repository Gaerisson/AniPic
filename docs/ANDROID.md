# AniPic sur Android

## Page d’installation intégrée

La page **https://anipic.gaerisson.fr/android** est fournie par le même projet et la même stack. Elle est accessible depuis le pied de page et l’accueil mobile, avec bouton de téléchargement, QR code, étapes et empreintes. Elle ne contient aucune donnée du refuge et ne désactive pas le PIN des API.

L’APK native 3.13.0 est incluse dans `public/downloads/`, avec son checksum. Vite la copie dans `dist/downloads/` et l’image Docker la livre avec le site. Il n’est pas nécessaire de créer un autre dépôt, une release APK séparée ou un serveur de fichiers. La version web 3.13.0 distribue cette APK native 3.13.0. Les exceptions Git/Docker ne concernent que cette distribution publique ; les clés et mots de passe restent exclus.

Lors d’une future mise à jour native, compiler et signer avec la même clé, mettre à jour `public/android-download.json`, le fichier APK et son `.sha256`, puis lancer `node scripts/check-android-download.mjs`. Les tests contrôlent aussi le paquet livré. La CI Android vérifie sa signature cryptographique et le certificat associé au domaine.

## Installer l’APK

**AniPic 3.13.0** (`fr.gaerisson.anipic`) ouvre **https://anipic.gaerisson.fr/?app=android#mobile**. L’application utilise les pages, médias, comptes et droits du même site, sans seconde base à synchroniser.

1. Mettre à jour la stack web avec le projet complet, en conservant ses volumes.
2. Vérifier que `https://anipic.gaerisson.fr/.well-known/assetlinks.json` répond **200, en JSON, sans connexion ni redirection**. AniPic sert ce fichier public ; un proxy protégeant tout le domaine doit laisser passer ce seul fichier de vérification. Les API restent protégées.
3. Installer `AniPic-3.13.0.apk` depuis le fichier fourni. Android peut demander d’autoriser ponctuellement l’installation depuis l’application ouvrant ce fichier. Aucune publication Play Store n’a été effectuée.
4. Utiliser un navigateur Android compatible et à jour, par exemple Chrome. Ouvrir AniPic, saisir le PIN si demandé puis se connecter normalement.

L’APK est une **Trusted Web Activity**, utilisant le navigateur Android dans une fenêtre dédiée. L’association domaine/certificat permet de retirer la barre d’adresse. Tant que la nouvelle version web et son fichier d’association ne sont pas déployés, le navigateur peut garder sa barre. Les connexions Google passent par le navigateur, sans authentification dans une WebView.

Le fichier [android-assetlinks.json](../public/android-assetlinks.json) contient uniquement l’identifiant Android et l’empreinte publique du certificat. **La clé privée et son mot de passe sont exclus du projet, du ZIP source et du contexte Docker. La clé reste dans le dossier privé local de compilation ; prévoir une sauvegarde privée séparée et ne jamais la publier sur GitHub.** Elle sert à signer les futures APK comme mises à jour de celle-ci.

## Utilisation et mises à jour

- **Fil** : fil filtré, actualisé chaque minute et au retour dans l’application ; liste de validation et historique pour les agents/administrateurs.
- **Photos** : animaux, portraits, albums, filtres, téléchargements et outils autorisés.
- **C8** : catalogue, reprise de lecture et commande plein écran du site. Les fichiers restent sur le serveur/NAS et doivent être lisibles par le navigateur du téléphone.
- **Plus** : tous les autres outils du site, selon les droits du compte.

Les modifications du site deviennent disponibles après actualisation, sans nouvelle APK à chaque évolution web. Un changement du conteneur Android, du domaine, de l’icône native ou de fonctions natives demande une nouvelle compilation avec un `versionCode` augmenté et **la même clé de signature**. Une mise à jour normale ne demande pas de désinstaller l’application.

Le fil conserve l’historique déjà chargé : l’actualisation automatique s’arrête après le chargement de pages anciennes. Les notifications push se configurent dans Compte & appareils, par catégorie puis par appareil. `?app=web#gallery` retrouve la disposition web. Le thème reste mémorisé par navigateur.

## Mise à jour intégrée

Installer une fois l’APK 3.12 depuis `/android` pour disposer du gestionnaire de mise à jour. La version 3.11 ne disposait pas du code natif nécessaire. Les versions suivantes sont détectées à l’ouverture, au retour dans l’application et toutes les 15 minutes lorsque la page est visible.

**Mettre à jour** ouvre le gestionnaire AniPic : il télécharge exclusivement depuis le domaine HTTPS prévu, refuse les redirections, contrôle la taille et le SHA-256, le nom de paquet, le code de version et la signature comparée à celle de l’application installée. Android peut demander l’autorisation « Installer des applications inconnues » pour AniPic, puis **toujours confirmer l’installation**. Les données restent conservées ; aucune désinstallation préalable. Ce mécanisme ne contourne pas les règles d’Android et ne publie pas sur Google Play.

Une mise à jour web propose simplement une actualisation. Enregistrer son travail avant de recharger. Les sessions sont mémorisées 90 jours et renouvelées à l’usage ; elles se révoquent dans Compte & appareils. Les notifications nécessitent une autorisation du navigateur et des essais sur les téléphones réellement utilisés.

## PIN et hors connexion

Le navigateur conserve le PIN selon les cookies d’AniPic, jusqu’à révocation ou suppression de ses données. Le PIN n’accorde aucun rôle d’équipe et les bénévoles Google restent soumis à approbation. L’application native ne lit pas les cookies du navigateur.

Le service worker conserve seulement trois fichiers publics : `/offline.html`, `/anipic-icon.svg`, `/offline-retry.js`. Aucun compte/token, réponse API, photo ou vidéo n’entre dans ce cache. Les écritures ne sont jamais rejouées. Sans réseau, un écran générique propose **Réessayer**, qui recharge réellement la page. Chaque version AniPic renouvelle le cache public.

L’installation depuis Chrome reste possible sans APK : ouvrir le site HTTPS puis **Installer l’application**. Une adresse HTTP de NAS ne remplace pas ce site HTTPS ; `localhost` sur Android désigne le téléphone lui-même.

## Recompiler

Sources dans [android/](../android). Chaîne vérifiée : **JDK 17, Gradle 8.13** avec checksum officiel, **AGP 8.13.2, API 36, Build Tools 35.0.0, Android Browser Helper 2.6.2**. Le SDK et le JDK ne sont pas inclus dans le ZIP source.

Installer les outils officiels, accepter leurs licences et configurer `JAVA_HOME` / `ANDROID_HOME`. Packages nécessaires :

```text
sdkmanager "platforms;android-36" "build-tools;35.0.0" "platform-tools"
```

Sous Windows, fournir `ANIPIC_KEYSTORE` (chemin de la clé existante) et `ANIPIC_KEYSTORE_PASSWORD` dans l’environnement, puis exécuter `./scripts/build-android.ps1`. Ne jamais inscrire le mot de passe dans un fichier du dépôt. Le script compile, lance lint, aligne et signe l’APK, vérifie sa signature et calcule son SHA-256. Il ne crée pas une nouvelle clé.

Pour des essais sans clé privée : `./scripts/build-android.ps1 -DebugBuild`. Sous Linux, depuis `android/` : `bash gradlew --no-daemon assembleDebug assembleRelease lintRelease`. La release ainsi obtenue reste **non signée** ; elle doit être alignée, signée et vérifiée avant distribution.

Le workflow [Validation Android](../.github/workflows/android.yml) compile ces variantes à chaque PR et push vers `main`. L’artefact debug est réservé aux essais, avec un certificat différent qui n’est pas associé au site public. Le workflow ne possède pas la clé de distribution.

Pour changer le domaine, adapter `twa-manifest.json`, le domaine fixe de `UpdateActivity.java`, les métadonnées `public/android-download.json`, les liens de mise à jour web, les valeurs du `twaManifest` dans `app/build.gradle`, `assetStatements` dans `strings.xml` et publier l’association sur le nouveau domaine. Bubblewrap est une référence de génération ; conserver les corrections Gradle, de sauvegarde et de liens des sources maintenues lors d’une éventuelle régénération. Régénérer les icônes web : `node scripts/build-app-icons.mjs`.

## Vérifications et limites

APK release réellement compilée, lint exécuté sans erreur, signature v1/v2/v3 vérifiée, manifeste compilé contrôlé (versionCode 31100, cible API 36). Variante debug également compilée. Lint conserve des avertissements de version plus récente disponible et de ressources du template inutilisées.

Interface vérifiée dans Chromium à 390 × 844 px et sur bureau, en clair/sombre, avec navigation, permissions et coupure/reprise simulée du serveur. **Pas d’installation sur téléphone ni d’émulateur, de connexion Google ou de lecture C8 sur Android.** Le dossier C8 n’est pas configuré dans la démo. L’association de production sera effective après déploiement ; aucun déploiement distant n’a été effectué ici.

Références officielles : [Trusted Web Activities](https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities), [OAuth Google et navigateurs intégrés](https://developers.google.com/identity/protocols/oauth2/policies), [compatibilité AGP 8.13](https://developer.android.com/build/releases/agp-8-13-0-release-notes).

© Gaerisson · AniPic
