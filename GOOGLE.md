# Connexion Google et comptes bénévoles

Les bénévoles peuvent demander un compte depuis **Se connecter → Continuer avec Google**, sans mot de passe AniPic. Chaque nouveau compte est **inactif et en attente** : aucune session d’équipe n’est délivrée avant validation par un administrateur.

## Configurer Google une fois

1. Dans [Google Cloud](https://console.cloud.google.com/auth/clients), créer ou choisir un projet et configurer Google Auth Platform (nom de l’application, public et coordonnées demandées par Google).
2. Créer un client OAuth de type **Application Web**. Pour des bénévoles avec des comptes Google personnels, utiliser un public externe ; le mode interne est réservé à l’organisation Workspace concernée. En mode test, ajouter les comptes de test autorisés dans Google Cloud.
3. Ajouter comme URI de redirection exacte `https://VOTRE-DOMAINE/api/auth/google/callback`. Pour le test local : `http://localhost:3036/api/auth/google/callback`.
4. Dans AniPic, ouvrir **Administration → Équipe & accès → Inscription des bénévoles · Google**. Copier l’identifiant client et le secret, puis activer et enregistrer la connexion.
5. Vérifier que `APP_ORIGIN` est l’adresse publique d’AniPic, sans slash final, et utiliser `COOKIE_SECURE=true` derrière HTTPS. La redirection affichée dans le formulaire doit correspondre exactement à celle enregistrée chez Google. Un domaine HTTPS est nécessaire hors localhost.

Les variables `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` sont également prises en charge dans `.env`, Compose et Portainer ; elles sont prioritaires sur les valeurs de l’interface. Aucun identifiant Google de production n’est livré dans le projet. Désactiver le connecteur ferme les sessions des comptes Google et bloque les nouvelles connexions.

Le secret saisi dans l’interface est conservé dans `.google-oauth-secret`, dans le volume de données SQLite, avec permissions restrictives à la création. Il n’est jamais renvoyé par l’API, ajouté à l’export JSON des paramètres ou publié dans Git. Conserver les identifiants OAuth dans votre gestionnaire de secrets pour une réinstallation : une sauvegarde de SQLite seule ne remplace pas ce secret. Le secret n’est pas demandé aux bénévoles.

## Valider les demandes

Dans **Équipe & accès → Demandes bénévoles**, vérifier le nom et l’adresse Google, puis choisir **Valider bénévole** ou **Refuser**. Une demande refusée peut être validée ultérieurement par cette même interface. La personne doit ensuite revenir avec **le même compte Google**. AniPic n’envoie pas de courriel automatique.

Les comptes approuvés apparaissent dans la liste habituelle des membres. Ils peuvent être désactivés ou changer de rôle par une action explicite de l’administrateur. La désactivation ferme leurs sessions. Le bouton générique Réactiver ne permet pas de contourner la validation d’une demande en attente ou refusée.

## Droits du rôle Bénévole

| Fonction | Accès |
| --- | --- |
| Fiches et photos des animaux, archives et références SPA | Consultation |
| Studio vidéo, fond animé, musique, assets et exports | Création |
| Fiche animal → Créer sa vidéo | Création, avec photo locale ou SPA |
| Éditeur photo | Fichier personnel et retouche d’une copie ; original préservé |
| Affiches de box, affiches en série, grandes affiches et visuels | Création et export |
| Albums privés de l’équipe | Consultation, création, import et organisation |
| Statistiques des animaux et vidéo C8 | Consultation |
| Avatar personnel, assistant et messages d’équipe ciblés | Accès équipe |
| Paramètres, comptes, visiteurs et stockage NAS | Aucun accès administrateur |
| Registre interne et configuration TV | Refusés |
| Archivage d’un animal, suppression de ses photos ou modification du planning | Refusés par ce rôle |

Les albums privés sont des espaces partagés avec l’équipe connectée ; il ne s’agit pas d’albums personnels isolés par bénévole. Le rôle n’autorise aucune modification des faits SPA. Les réglages globaux de publication, de réseau et de stockage restent appliqués.

## PIN et vérification de l’identité

Les trois routes d’entrée Google sont accessibles pour démarrer et terminer la connexion, comme la route de connexion par mot de passe. Cela ne désactive pas le PIN des autres API ou médias. Un compte en attente n’obtient ni session, ni autorisation PIN. Un compte Google validé possède une session AniPic normale de 12 heures, indépendante de la mémorisation PIN. Déverrouiller le PIN seul ne donne aucun rôle bénévole.

Le retour Google utilise un cookie temporaire HttpOnly et SameSite=Lax, limité aux routes Google. L’état est aléatoire, lié au navigateur, à usage unique et limité à dix minutes ; échange par code avec PKCE S256. La bibliothèque officielle Google vérifie la signature du jeton, son émetteur, son audience et sa validité ; AniPic vérifie également le nonce et l’adresse e-mail confirmée. L’identité est associée au `sub` Google, jamais fusionnée automatiquement avec un compte existant par son e-mail ou son nom. Aucun accès Gmail, Drive ni jeton Google de renouvellement n’est demandé ou conservé.

Références : [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [flux OAuth serveur](https://developers.google.com/identity/protocols/oauth2/web-server), [bibliothèque officielle Node.js](https://github.com/googleapis/google-auth-library-nodejs).

## Vérification

Les tests emploient des JWT réellement signés avec une clé RSA locale et la vérification de signature de la bibliothèque Google : état, navigateur, expiration, PKCE, nonce, mauvais émetteur/audience/signature, e-mail non confirmé, refus/validation/désactivation et droits du rôle. Le transport vers Google est simulé. Une connexion réelle sur votre domaine exige vos identifiants OAuth et reste à vérifier après leur configuration.
