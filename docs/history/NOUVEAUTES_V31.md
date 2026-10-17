# Guide Anipic 3.1

## Programmer la TV

Ouvrir Administration → Écran du refuge. Choisir les espèces et les animaux exclus, les photos par animal, les durées et le style. L’interrupteur **Afficher les statistiques** retire toutes les séquences statistiques, automatiques comme manuelles.

La **Timeline de diffusion** affiche l’ordre et la durée des séquences. Cliquer une carte place l’aperçu sur cette séquence en pause. « Insérer vidéo » utilise un média importé dans le studio ; choisir l’animal après lequel le clip doit jouer, ou le début du programme. Les messages disposent d’un titre, texte, durée et thème (classique, Halloween, Noël, été). Leur position suit le nombre d’animaux effectivement présentés ; une position au-delà de la sélection est placée en fin de boucle.

Les réglages de prévisualisation restent privés tant que le programme n’est pas enregistré. Un clip inséré devient lisible par l’adresse TV après activation et enregistrement. Le retirer ou désactiver l’écran retire cet accès. Les vidéos se lisent muettes ; les exports TV sont muets.

Dans Diffusion, activer l’écran puis **Enregistrer**. Copier le lien web. Sur le téléviseur, utiliser l’adresse du serveur, pas localhost. `APP_ORIGIN/#display` lit la boucle, applique les horaires Europe/Paris et relit le programme chaque minute. La touche espace met en pause, les flèches changent de séquence ; le bouton plein écran requiert l’interaction du navigateur. Anipic ne pilote pas l’alimentation du téléviseur.

## Bilan et réseaux

Le studio propose le bilan **Mosaïque SPA** avec la sélection/exclusion des animaux déjà disponible. Les noms et portraits défilent, les tuiles se rassemblent, puis le logo SPA original se dévoile. Les chiffres d’adoption sont ceux observés dans les statuts datés ; les nombres chiens/chats du bilan portent sur la sélection.

Dans Fonds animés & réseaux, choisir le rythme **Dynamique** pour la mosaïque ou les présentations. Le mode Doux reste adapté à une diffusion longue à l’accueil. Les orientations et exports MP4 restent réglables.

## Messages d’équipe

Administration → Messages équipe : destinataire, rôle ou toute l’équipe. À l’accueil du destinataire, un popup propose **Lu** ou **Plus tard**. Lu enregistre un reçu pour ce compte ; Plus tard laisse le message disponible dans l’assistant et à la prochaine arrivée à l’accueil. Les messages sont aussi consultables dans l’assistant, avec les éléments déjà lus.

## Mistral

Réglages → API & connexions → Audio · Mistral : saisir une clé, les identifiants des modèles et éventuellement une voix. **Enregistrer Mistral** ne fait pas d’appel réseau. Le bouton voix du studio récupère ensuite le catalogue quand demandé. La clé d’environnement `MISTRAL_API_KEY` reste prioritaire sur la clé d’interface ; le champ vide conserve celle déjà enregistrée.

La clé d’interface réside dans `DB_DIR/.mistral-key`, avec droits de fichier privés. Elle ne figure pas dans les réponses API, journaux d’audit, exports JSON ni sauvegardes Anipic. Une restauration exige de la renseigner de nouveau. Les modèles et la voix sont dans SQLite.

## Visiteurs

Administration → Visiteurs : période de 1 / 7 / 30 jours, graphe quotidien et journal filtrable par IP ou compte. Un identifiant éphémère par onglet sert à estimer les sessions ; il ne constitue pas un comptage exact des personnes. Seules les routes générales sont envoyées, sans termes de recherche. IP et user-agent viennent de la connexion ; le compte est associé si connecté.

Pour le pays, le proxy doit fournir une géolocalisation et **remplacer** l’en-tête configuré, puis supprimer toute valeur venant du client. Définir `VISITOR_COUNTRY_HEADER` (par exemple `cf-ipcountry`), `TRUST_PROXY=true` et les CIDR exacts dans `PROXY_TRUSTED_IPS`. Sans proxy configuré, le pays reste non déterminé. Aucun service tiers de géolocalisation n’est interrogé. Les visites sont conservées 30 jours ; le journal affiche au plus 500 lignes à la fois.

## Paramètres et communication

Configuration → **Exporter les paramètres** télécharge l’interface, les réglages SPA, la programmation TV et les noms de modèles audio. Les clés, comptes et photos sont exclus. Ce fichier sert de relevé de configuration ; cette version ne fournit pas de restauration automatique de ce JSON.

La fiche animal comporte le bouton **Créer l’affiche de box**. Le pack réseaux reste dans un volet distinct du dialogue. Le QR est activable ; il pointe vers la fiche SPA ou, si le lien individuel manque, vers le refuge. Le studio affiche aussi un QR dans les portraits vidéo, désactivable dans le montage.
