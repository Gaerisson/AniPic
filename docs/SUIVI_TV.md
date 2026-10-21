# Suivre les écrans TV

Dans **Écran du refuge**, ouvrir **Suivi des TV**. Cette page est réservée à l’administration et aux agents SPA, comme les réglages du programme.

## Connecter et nommer un écran

1. Ouvrir le lien `https://votre-anipic/#display` dans le navigateur de la TV. Après une mise à jour d’AniPic, recharger la page TV pour recevoir le nouveau lecteur.
2. Saisir le PIN du site si nécessaire. L’autorisation déjà mémorisée reste valable ; le suivi ne donne aucun accès supplémentaire.
3. La TV apparaît automatiquement dans le suivi. Choisir **Renommer**, par exemple « Accueil » ou « Salle d’attente ».

Chaque profil de navigateur reçoit une identité aléatoire conservée localement. Une réouverture sur la même adresse reprend le même écran. Effacer le stockage du navigateur ou changer d’adresse crée une nouvelle identité ; l’ancienne peut être retirée du suivi. Si le stockage local est bloqué, le suivi fonctionne pour la session du navigateur et l’indique dans les informations.

Les aperçus de l’administration et le module TV de l’accueil ne sont pas enregistrés comme des TV. Seul le lecteur plein écran ouvert par le lien TV transmet son état.

## Lire les statuts

| Indication | Signification |
| --- | --- |
| Connectée | Le navigateur transmet son état et n’indique pas de problème courant. |
| Connectée · à vérifier | Images ou vidéo indisponibles, démarrage vidéo bloqué, lecture sans progression, onglet masqué ou actualisation attendue. |
| Hors ligne | Aucun contact depuis plus de 75 secondes. |
| En pause | Pause demandée dans le lecteur ; le navigateur reste connecté. |
| Hors plage de diffusion | Le programme attend sa prochaine plage horaire ; le suivi reste actif. |
| Programme désactivé | Le navigateur TV est ouvert, mais la diffusion est désactivée dans AniPic. |

Le lecteur envoie son état toutes les **20 secondes**, ainsi qu’aux changements d’état ou d’incident. La page de suivi s’actualise toutes les **15 secondes** et au retour dans l’onglet ; **Actualiser** force une lecture immédiate. Le programme TV continue d’être récupéré chaque minute.

Chaque carte montre la séquence signalée par le lecteur, son avancement, la résolution, le mode fenêtre/plein écran et l’état visible/masqué de l’onglet. **Dernier contact** vient de l’horloge du serveur. **Dernière actualisation du programme** est estimée par le serveur à partir du temps écoulé depuis le dernier chargement réussi signalé par la TV. **Réglages reçus** compare les réglages effectivement appliqués avec ceux enregistrés dans AniPic.

Une actualisation de plus de 150 secondes est signalée. L’attente de données vidéo doit durer cinq secondes avant d’être considérée comme un incident ; une pause ou une plage de repos ne sont pas prises pour un blocage. Lorsqu’une nouvelle sélection d’images n’est pas encore prête, le lecteur conserve le programme déjà chargé.

## Incidents et retrait

Dans **Historique et informations**, retrouver les huit événements les plus récents, leurs dates et les messages d’incident ou de reprise. Jusqu’à 50 événements sont conservés par écran ; une erreur identique répétée ne remplit pas l’historique. Le navigateur, l’adresse réseau et le premier contact sont visibles uniquement aux gestionnaires des TV.

**Retirer du suivi** révoque l’identité de suivi après confirmation, sans arrêter la vidéo et sans modifier le programme. Pour suivre à nouveau cette TV, afficher ses commandes puis choisir **Réactiver le suivi TV**. Une nouvelle identité est créée. Les anciennes traces sont conservées dans SQLite et les actions de gestion figurent au journal.

## Accès et limites

Le suivi repose sur les signaux du navigateur. Il ne peut pas confirmer physiquement qu’une dalle est allumée ni vérifier visuellement chaque pixel. Une coupure électrique ou réseau est déduite de l’absence de contact. Un navigateur qui suspend son activité peut aussi être signalé hors ligne. L’adresse `localhost` concerne l’appareil qui l’ouvre : utiliser l’adresse réseau du serveur/NAS sur la TV.

Le navigateur possède uniquement un secret permettant d’envoyer son propre état. Il ne peut ni lister les autres écrans, ni consulter les informations de gestion. Le secret reste hors des URLs et son empreinte seule est conservée sur le serveur. Le PIN global continue de protéger les requêtes lorsqu’il est activé ; le secret de suivi ne le contourne pas. Les écritures des gestionnaires demandent une session, le rôle autorisé et le jeton CSRF.

Aucun service externe, port supplémentaire ou dépendance n’est nécessaire. Les données sont sauvegardées avec SQLite. La migration **20 → 21** ajoute deux tables et un index, sans modifier les volumes, photos, comptes ou paramètres existants. Les nouvelles inscriptions sont limitées à dix par heure et adresse réseau, et cent écrans actifs ; un écran déjà inscrit continue à transmettre normalement.


## Réglages par écran et aperçu réel (3.12)

Dans la carte d’une TV, ouvrir **Réglages & aperçu réel**. Chaque écran peut remplacer l’orientation, la durée des photos, les espèces, les statistiques et le QR du programme général, et choisir sa fréquence d’actualisation (15–300 secondes). La prise en compte intervient au prochain contact du lecteur, généralement sous 20 secondes.

**Capturer l’écran** demande un JPEG du lecteur AniPic connecté, pas du bureau de la télévision. **Suivi visuel · 45 s** renouvelle la demande tant que ce panneau est ouvert et visible. La date de capture reste affichée : une ancienne capture n’est pas présentée comme une vidéo en direct. Les images restent privées aux agents/administrateurs et ne sont conservées que 24 h. Une capture peut être désactivée écran par écran.

Le suivi affiche aussi la durée d’ouverture, le réseau déclaré par le navigateur, les reconnexions et la densité d’affichage. Au retour du réseau, le programme est rechargé ; pendant une interruption, le dernier reçu est gardé tant que la page reste ouverte. Un redémarrage de navigateur recharge sa configuration avec l’identité d’écran conservée localement. AniPic ne peut pas rallumer une TV éteinte, démarrer son navigateur à la place du système, ni rétablir un plein écran nécessitant un geste utilisateur : configurer le navigateur/kiosque de l’appareil pour ces points.
