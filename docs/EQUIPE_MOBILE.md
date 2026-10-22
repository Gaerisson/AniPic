# Équipe, planning et notifications

Dans **Présences & missions**, les agents et administrateurs créent des créneaux de collecte, nettoyage, soins, promenade, photographie ou accueil. Ils fixent date, horaires, lieu, informations et capacité. Une création peut être répétée chaque semaine jusqu’à 12 occurrences ; chacune se modifie ensuite séparément. Les modifications concurrentes sont signalées avant écrasement.

Chaque compte actif peut indiquer **Présent / Peut-être / Absent**, rejoindre une liste d’attente si le créneau est complet, ou renseigner sa disponibilité personnelle. La synthèse affiche les personnes uniques par jour et leurs tâches ; elle évite de compter deux fois une personne inscrite à plusieurs missions. L’export CSV du jour est réservé aux agents et administrateurs. Une annulation est conservée dans le journal, sans effacement des inscriptions historiques.

L’accueil mobile résume les arrivées, adoptions et changements des sept derniers jours, les présences et vos prochains créneaux. Le bas de l’application donne accès à **Accueil, Fil, Planning, Photos et C8**, puis Plus. Le fil affiche un seul événement par ligne. Les anciens liens Adoptions restent utilisables.

## Choisir ses notifications

Ouvrir **Compte & appareils**, cocher les catégories utiles (arrivées, adoptions, portraits publics, modifications de vos missions), puis **Activer sur cet appareil**. Le navigateur demande son autorisation. Répéter sur chaque téléphone ou navigateur voulu. Une catégorie cochée ne suffit pas à activer un appareil.

Le serveur utilise Web Push et génère sa paire VAPID privée dans SQLite, hors des paramètres exportables. Il regroupe les photos nouvelles par animal, ne rejoue pas les anciens événements au premier démarrage et conserve la file de livraison. Les échecs transitoires ont trois tentatives bornées ; une souscription expirée est retirée. Les notifications sont liées à la session : une déconnexion/révocation retire sa souscription. Pas d’envoi WhatsApp, d’e-mail ou de SMS implicite.

HTTPS, accès sortant vers le service push du navigateur et compatibilité du téléphone sont nécessaires. La réception réelle, la veille Android et les restrictions de batterie doivent être validées sur les appareils du refuge. Aucune garantie de réception immédiate hors réseau.

## Rédaction et relecture

**Rédaction & relecture** propose une composition sans IA et le service Token Harbor déjà configuré. Saisir des faits ou un texte simple, choisir le style, générer puis relire/copier la proposition. Le mode relecture signale notamment descriptions absentes/courtes, espaces, ponctuation et certains mots à vérifier ; le filtre **Sans photo locale** aide à préparer les prochains portraits. Ce repérage n’est pas un correcteur grammatical exhaustif. Le service IA n’est appelé que sur action explicite ; aucun texte SPA n’est modifié automatiquement.

Les brouillons appartiennent à leur auteur. Les faits, négations, réserves et ententes sont à vérifier avant publication. Ne pas fournir de données personnelles inutiles au prestataire IA.

**Découvrir AniPic · 1 minute** donne un parcours court, disponible depuis l’accueil mobile et le pied de page. Les outils affichés suivent les modules et habilitations de chaque installation.

## Options Android et sondages — 3.13

L’accueil et les boutons du bas sont personnalisables depuis **Options de l’application**. Valeurs initiales : Refuge, Fil, Photos, Albums et C8. Widgets, ordre, thème, texte plus grand et animations sont mémorisés dans le navigateur de l’appareil. Un thème déjà choisi reste prioritaire ; sinon l’application démarre en SPA clair.

Dans **Compte & appareils**, l’état de l’autorisation et l’enregistrement de l’appareil sont affichés. Le bouton **Tester les notifications** confirme que le service a accepté l’envoi ; il faut aussi vérifier sa réception sur le téléphone. Une reconnexion du même compte permet de réassocier l’abonnement à sa nouvelle session. Les sessions révoquées restent bloquées.

Les [sondages d’équipe](WHATSAPP.md) sont accessibles depuis le menu et peuvent être ajoutés aux raccourcis Android. Voir aussi le [guide des créations et de la relecture](CREATIONS_ET_APPLICATION.md).
