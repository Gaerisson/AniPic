# Créer dans Canva

Depuis une fiche animal, le bouton **Créer dans Canva** prépare une présentation contenant des photos et des objets texte éditables. Aucun logo Anipic n’est ajouté au pré-design. Les animations, la durée des pages, la musique et l’export MP4 se règlent ensuite dans Canva. Cette intégration n’est pas un éditeur Canva embarqué ni une synchronisation automatique dans les deux sens.

## Utilisation

1. Choisir de 1 à 8 photos locales. L’ordre de sélection devient l’ordre du diaporama ; le bouton **Couverture** passe une photo en première position. Photos privées et archivées sont identifiées et sélectionnables volontairement.
2. Choisir Story 9:16, Publication 4:5 ou Présentation 16:9, puis Éditorial, Nuit ou Sauge. Régler la couleur, la phrase finale et l’inclusion de la description/des ententes SPA. Les données de l’animal restent en lecture seule.
3. Vérifier les pages dans l’aperçu. Le prénom, le statut personnalisé, l’espèce, le sexe, la race lorsqu’elle est connue, une description abrégée et les ententes proviennent de la fiche locale synchronisée avec la SPA. Aucun fait n’est inventé.
4. **Envoyer le pré-design à Canva** : le serveur génère un PPTX en mémoire et l’importe dans le compte Canva connecté. Le suivi apparaît dans **Mes créations pour cet animal**. Le bouton **Ouvrir dans Canva** récupère un lien d’édition frais et ouvre l’éditeur dans un nouvel onglet.
5. Dans Canva, modifier librement photos et textes, ajouter animations/vidéos/musique, puis exporter. Ces modifications ne remplacent jamais les originaux ou les informations SPA dans Anipic.

Sans connexion, **Télécharger le PowerPoint** fonctionne déjà. Importer ensuite ce fichier dans Canva. Le contenu comprend de vrais textes et images distinctes, pas des diapositives aplaties. L’aperçu Anipic est indicatif : les polices, les sauts de ligne et les recadrages peuvent varier après l’import Canva.

## Activer le connecteur

Créer une application dans le [portail développeur Canva](https://www.canva.com/developers/), avec la surface **Outside Canva** / API REST. Générer le client ID et le secret. Selon la configuration et le statut de l’application, Canva peut restreindre les comptes autorisés en développement ou demander une validation avant une diffusion plus large. Anipic ne crée pas d’application ni de compte Canva à votre place.

Activer ces deux permissions, et uniquement celles-ci :

- `design:content:write` : importer la présentation.
- `design:meta:read` : retrouver un lien d’édition pour les créations enregistrées.

Déclarer une URL de retour correspondant exactement au serveur Anipic, par exemple :

```text
https://anipic.exemple.fr/api/canva/callback
```

Dans `.env` ou **Portainer → Stack → Environment variables**, renseigner :

```dotenv
APP_ORIGIN=https://anipic.exemple.fr
COOKIE_SECURE=true
CANVA_CLIENT_ID=identifiant_de_votre_application
CANVA_CLIENT_SECRET=secret_de_votre_application
CANVA_TOKEN_KEY=cle_aleatoire_base64_de_32_octets
CANVA_REDIRECT_URI=https://anipic.exemple.fr/api/canva/callback
```

Générer **une seule fois** la clé de chiffrement, par exemple sur le serveur :

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Conserver cette clé dans le gestionnaire de secrets du serveur, pas dans le dépôt ni dans un message. Les Compose fournis transmettent ces quatre variables au conteneur. Redémarrer/recréer le service après modification de son environnement. Dans **API & connexions → Canva → Configurer le connecteur**, vérifier les variables manquantes et l’URL de retour ; les valeurs des secrets ne sont jamais affichées.

Chaque administrateur, photographe ou agent connecte ensuite **son propre compte Canva**, depuis cette page ou une fiche animal, puis approuve les permissions dans Canva. Les lecteurs ne peuvent pas utiliser le connecteur. Les créations affichées et les connexions sont propres au compte Anipic connecté.

Pour la démo locale : `APP_ORIGIN` et le navigateur doivent employer le même hôte. Exemple avec `http://localhost:3036/api/canva/callback` si cette URL est acceptée par le portail Canva ; sinon employer `http://127.0.0.1:3036` partout, y compris dans l’origine de la démo. Canva documente une URL de boucle locale pour son kit de démarrage. En production, Anipic exige HTTPS. Une URL différente, un proxy qui supprime le préfixe `/api`, ou un cookie bloqué empêche le retour OAuth. `scripts/preview.mjs` est une démo sans secrets ; utiliser le lancement normal pour une configuration réelle.

## Confidentialité et reprise

- Connexion OAuth Authorization Code avec PKCE SHA-256, état aléatoire valable 10 minutes, lié au compte et à sa session, consommé une seule fois. La connexion n’envoie aucune photo.
- Les jetons d’accès/renouvellement restent côté serveur, chiffrés AES-256-GCM avec `CANVA_TOKEN_KEY`, et liés au client ID et au compte Anipic. Le secret client reste dans l’environnement. Les renouvellements sont sérialisés par compte pour éviter de réutiliser un ancien refresh token.
- L’envoi transmet uniquement la sélection explicite, sous forme de JPEG de 1920 px maximum sans EXIF/GPS, et les informations du pré-design. Une photo privée sélectionnée est donc envoyée à Canva : vérifier la sélection avant de cliquer. Aucun lien public vers le NAS, aucun original, aucune note interne et aucun album privé sans rapport ne sont transmis.
- Le PPTX est calculé en mémoire puis envoyé en HTTPS, sans fichier export permanent sur le NAS. Deux générations simultanées au maximum ; huit photos par création. L’historique conserve les identifiants de créations, pas de copies d’images. Le fichier peut contenir plusieurs occurrences de la même photo nécessaires à la mise en page.
- Aucun envoi automatique ni nouvelle tentative automatique d’import après un délai réseau incertain. En cas d’envoi interrompu, vérifier les créations dans Canva avant de recommencer, afin d’éviter les doublons. Les imports en cours peuvent être revérifiés depuis l’historique après un redémarrage.
- Le bouton **Déconnecter mon compte** retire toujours l’accès local et tente de révoquer le jeton auprès de Canva. Si Canva ne répond pas ou si la clé a changé, l’interface demande aussi de révoquer l’application dans les paramètres Canva. Les créations Canva existantes ne sont pas supprimées.
- Une restauration Anipic conserve l’historique, mais invalide les sessions et retire les connexions OAuth restaurées : reconnecter les comptes. Les clés d’environnement ne sont pas incluses dans les sauvegardes Anipic. Sauvegarder séparément la configuration serveur.
- La route de retour OAuth n’est pas journalisée par le logger Fastify ; le journal d’accès Anipic conserve uniquement le chemin sans paramètres. Configurer aussi le reverse proxy pour ne pas conserver les paramètres `code` et `state` dans ses propres journaux, et activer HTTPS.

## Ce qui a été vérifié

Tests locaux : PKCE, état/session, anti-rejeu, permissions et CSRF, isolation des comptes, rotation des jetons, chiffrement, origine de retour, validation des liens Canva, sélection des photos par ID, export PPTX avec textes/images séparés et JPEG sans EXIF, suivi d’import, restauration sans jetons actifs. Les appels Canva des tests sont simulés.

**Pas encore vérifié sur un vrai compte Canva** : aucun client ID/secret ni compte autorisé n’a été fourni. Le rendu final dans Canva, la validation de votre application et les fonctions vidéo disponibles sur votre forfait restent à vérifier après connexion. Les API d’import officielles sont utilisées ; l’intégration ne dépend pas d’Autofill ni d’un modèle de marque payant.

Documentation officielle consultée le 15 octobre 2026 : [Authentification](https://www.canva.dev/docs/apps/rest-apis/authentication/), [import éditable et formats pris en charge](https://www.canva.dev/docs/apps/rest-apis/reference/design-imports/), [créer un import](https://www.canva.dev/docs/apps/rest-apis/reference/design-imports/create-design-import-job/), [suivre un import](https://www.canva.dev/docs/apps/rest-apis/reference/design-imports/get-design-import-job/), [retrouver un design](https://www.canva.dev/docs/apps/rest-apis/reference/designs/get-design/), [révoquer un jeton](https://www.canva.dev/docs/apps/rest-apis/reference/authentication/revoke-token/).
