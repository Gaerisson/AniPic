# WhatsApp et AniPic

Recherche vérifiée le 15 novembre 2026 pour deux usages : envoyer photos/bilans au groupe du refuge et interroger AniPic depuis WhatsApp.

## Disponible dans AniPic

Après **Copier le lien fiche/photo**, le menu des liens propose **Préparer dans WhatsApp**. Le lien public est prérempli ; vous choisissez le destinataire ou le groupe puis confirmez dans WhatsApp. Il reste limité à son élément, révocable et valable trente jours. Le téléchargement public est en JPG. La Gazette possède déjà un raccourci WhatsApp pour son texte préparé.

Ce partage manuel ne connecte aucun numéro au serveur et n’envoie aucun message automatiquement.

### Sondages et fichiers déjà disponibles

Dans **Équipe → Sondages**, un agent prépare une question, ses choix, les réponses multiples éventuelles et les dates d’ouverture/clôture. **Partager** prépare WhatsApp avec le lien AniPic ; chacun choisit le groupe et confirme l’envoi. Les membres approuvés votent dans AniPic, peuvent changer de réponse pendant l’ouverture et consultent des résultats agrégés. L’ouverture/clôture et l’actualisation des résultats sont gérées par AniPic ; ce n’est pas un sondage natif WhatsApp ni une inscription automatique à une mission. Ces liens ordinaires conservent le PIN et les permissions de l’instance.

Pour la Gazette, le menu de partage du téléphone peut aussi transmettre un PDF ou une image à WhatsApp quand le système prend en charge le partage de fichiers. Aucun fichier n’est publié automatiquement dans une communauté.

## Options pour un bot

| Option                          | Photos/bilans                                                    | Commandes entrantes                                     | Conditions importantes                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Meta WhatsApp Business Platform | Envoi programmatique de textes et médias                         | Réception par webhooks et traitement par un service     | Compte professionnel, numéro, autorisations, règles de messagerie et tarification Meta                                            |
| Meta Groups API                 | Groupes créés et gérés par l’API                                 | Réception et traitement des messages du groupe          | Compte professionnel officiel OBA, huit participants maximum ; pas disponible pour les numéros de l’application WhatsApp Business |
| Baileys, service séparé         | Client WhatsApp Web via sockets, à adapter aux groupes autorisés | Un service Node peut traduire des commandes vers AniPic | Client non officiel, session d’appareil liée à conserver et compatibilité à maintenir                                             |
| whatsapp-web.js, service séparé | Texte, médias et fonctions de groupes                            | Événements de messages et réponses                      | Client non officiel avec navigateur Chromium, association par QR et session persistante                                           |

Sources primaires : [Meta Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups), [plateforme Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview), [Baileys](https://github.com/WhiskeySockets/Baileys), [whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js), [fonctions du client](https://docs.wwebjs.dev/), [authentification](https://wwebjs.dev/guide/creating-your-bot/authentication). Le projet whatsapp-web.js indique explicitement qu’un blocage du compte reste possible : [présentation et limites](https://wwebjs.dev/guide/).

## Montage adapté au groupe de l’équipe

Pour le groupe WhatsApp actuel et des commandes, une passerelle séparée est la piste à évaluer. Elle doit être associée à un numéro choisi par le refuge, autorisée uniquement dans le groupe prévu et limitée aux membres habilités. Les sessions WhatsApp donnent accès aux conversations du compte : elles restent hors de GitHub, dans un stockage privé. Le choix du numéro et du fournisseur précède toute connexion réelle.

Commencer par des commandes de lecture : `!aide`, `!fiche NOM`, `!photos NOM`, `!bilan`. Un nom ambigu doit proposer les références SPA/identifiants avant de répondre. Un bilan doit distinguer les adoptions confirmées des absences à vérifier. Les photos transmises doivent être publiques et l’URL partagée doit utiliser l’adresse accessible de l’instance.

Les écritures comme `!sync`, l’attribution ou une adoption exigent une authentification et des droits dédiés, la protection anti-rejeu et une confirmation explicite. Ne pas exposer une session administrateur à tous les membres d’un groupe. Les messages non autorisés ou les conversations privées ne doivent déclencher aucune commande.

AniPic utilise actuellement des sessions et CSRF, pas un jeton universel de bot. Le [guide API](API_ANIMAUX.md) décrit les lectures et leurs protections ; les liens publics `/s/...` conviennent au partage limité. Une passerelle doit gérer ses droits, sa session et la révocation, sans contourner le PIN ni publier les originaux. Le bouton de synchronisation de la barre supérieure utilise le même contrôle administrateur que la page Synchronisation.

La présente release livre le raccourci de préparation et cette étude. Elle n’installe pas de bot, ne connecte aucun compte WhatsApp et ne crée pas de webhook public. L’intégration d’un bot demande le choix du numéro et de la solution, puis une configuration et un essai sur un groupe dédié.
