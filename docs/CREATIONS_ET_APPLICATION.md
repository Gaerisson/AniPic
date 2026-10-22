# Créations, application et équipe — AniPic 3.13

## Bannières créatives

Ouvrir **Création → Visuels & bannières → Bannières créatives**. Les mosaïques et fonds précédents restent dans le second onglet.

1. Choisir une composition : refuge panoramique, duo de verre, éditorial, papier ou saison.
2. Choisir un animal de chaque côté. Le sélecteur indique **photo locale** ou **photo SPA** ; la référence SPA reste sélectionnable même avec un portrait local.
3. Le détourage automatique prépare un vrai PNG transparent, localement sur le serveur. L’état du traitement est affiché. Les deux animaux sont traités successivement, même si l’on change de sélection pendant un traitement.
4. Ajouter éventuellement une photo du refuge en arrière-plan et un bandeau de contact. Régler les textes, la saison, les particules et leur densité.
5. Glisser le titre, le logo ou les animaux sur l’aperçu. Les curseurs proposent aussi un réglage sans glisser, notamment sur téléphone.
6. Exporter le PNG lorsque toutes les images et les transparences nécessaires sont prêtes. Un échec reste visible et permet de réessayer. Les originaux ne sont pas remplacés.

Le premier détourage télécharge le modèle BiRefNet si son cache manque. Prévoir au moins 3 Gio de mémoire disponible, environ 4 Go alloués au conteneur, et la connexion nécessaire au premier téléchargement. Un seul détourage est exécuté à la fois. Les contours très fins et les photos déjà coupées peuvent nécessiter un autre portrait. Il est possible de décocher le détourage pour conserver la photo entière.

**Mémoriser mon template** conserve les textes, animaux et positions dans ce navigateur. Une photo de fond importée doit être rechargée après fermeture de la page. Ce réglage ne publie aucun fichier sur un réseau social.

## Rédaction et relecture

**Équipe → Rédaction & relecture** propose deux modes : présentation d’un animal et correction d’une fiche SPA. Token Harbor est présélectionné quand il est configuré ; sinon, la composition locale reste disponible.

Les propositions IA peuvent utiliser des paragraphes, quelques émojis et les ententes vérifiées. Les conditions comme « oui si habitué » doivent conserver leur sens. En relecture, les retraits sont barrés et les ajouts soulignés, avec les changements de ponctuation et d’espacement. Le texte final reste modifiable et copiable. AniPic ne remplace jamais directement le texte publié sur le site SPA.

## Bilan annuel incomplet

Dans le studio vidéo annuel ou les réglages de l’écran du refuge, développer **Adoptions [année]**. Un agent ou administrateur peut choisir :

- le calcul automatique d’AniPic ;
- un nombre d’adoptions antérieures à ajouter aux observations ;
- un total explicite pour cette année.

Le choix s’applique aux créations vidéo et au programme TV de l’année concernée. Il ne modifie ni le statut des animaux, ni l’historique SPA. Les autres années gardent leur calcul automatique.

## Application Android

L’accueil, les pages et les créations sont servis par le même site. La plupart des évolutions web arrivent donc dans l’application après le déploiement, sans réinstallation de l’APK.

**Options de l’application** permet de choisir les boutons du bas, leur ordre, les widgets de l’accueil et leur ordre. Refuge reste accessible ; les valeurs initiales sont **Refuge, Fil, Photos, Albums et C8**, plus le menu général. Le thème initial est **SPA clair**, sauf si un autre choix a déjà été mémorisé dans le navigateur utilisé par l’application.

**Compte & appareils** permet d’activer les notifications sur chaque appareil, de connaître l’état de l’autorisation et d’envoyer un test. Après reconnexion du même compte, l’abonnement peut être réassocié à sa nouvelle session. Un autre compte doit recréer son propre abonnement. HTTPS et un navigateur compatible sont nécessaires ; le test sur un téléphone réel reste indispensable après déploiement.

Le didacticiel se présente à la première visite, peut être passé et se relance depuis le pied de page. Il montre directement les pages expliquées.

## Prénoms

La base de propositions contient plus de 1 500 prénoms, répartis par thèmes. Les noms des animaux encore présents au refuge et ceux du dernier catalogue national SPA validé sont exclus. Les noms des animaux partis ou archivés restent réutilisables.

Le catalogue national est actualisé automatiquement vers **03 h 15, heure de Paris**, lorsque le planificateur du serveur est actif. Une installation sans cache commence sa lecture au démarrage. Les propositions utilisent immédiatement le dernier relevé complet pendant sa mise à jour ; une panne garde ce relevé et affiche l’erreur. Une actualisation manuelle est aussi disponible à l’équipe, avec délai de protection entre tentatives.
