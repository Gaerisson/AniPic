# Les réglages du quotidien

## Trier une série

Le badge **Photos à trier** indique les images actives qui restent à attribuer. Cliquer une photo l’ouvre en grand ; la case indépendante sert à sélectionner. Les flèches naviguent dans la page affichée. **Ça ressemble à…** propose une comparaison source/référence locale ou SPA ; **Choisir cet animal** prépare la destination, puis **Attribuer** confirme l’opération. Le nom et l’identifiant restent à contrôler, surtout pour les homonymes : la ressemblance n’est pas une reconnaissance d’identité.

## Importer les fiches SPA chaque soir

Dans **Configuration → Connexions**, sélectionner la source et sa planification. **Tous les jours à heure fixe** permet de choisir 23:00 et **Europe/Paris** sans expression cron. **Configuration rapide** propose un profil quotidien avec adoption automatique après les confirmations d’absence fiables, et garde les présences observées courtes en attente. Enregistrer les paramètres pour l’activer. Ce profil ne modifie pas silencieusement les réglages conservés d’une ancienne installation.

Le profil utilise deux inventaires complets confirmant l’absence ; avec un passage quotidien, ils se font sur des journées distinctes. Les inventaires partiels, filtrés, suspects ou trop anciens ne comptent pas comme confirmation. Le serveur doit fonctionner à l’heure prévue ; si un passage a été manqué, le bouton **Synchroniser** de la barre supérieure permet de lancer la collecte manuellement. Ce bouton est réservé à l’administration et suit le job jusqu’à son résultat.

Le seuil **présence observée inférieure à** vaut deux heures et est réglable. La durée est celle observée par AniPic, pas une date de publication certaine de la SPA. Avec un seul passage par jour, un animal vu une seule fois reste un cas incertain ; sa disparition demande alors une confirmation. Les anciennes fiches sans début observé fiable ne sont pas classées artificiellement comme nouvelles présences courtes. Les exceptions manuelles restent à confirmer même si le mode global est changé ensuite.

Pour toutes les adoptions manuelles, choisir **Demander une confirmation obligatoire, sans compter avant**. Les confirmations/refus restent dans **Équipe → Adoptions à confirmer**. Une réapparition sur la source réconcilie les décisions existantes ; les photos et originaux restent conservés.

## Photos écartées

Écarter rend une photo restaurable, sans l’attribuer. Dans l’onglet **Photos écartées**, l’administration peut activer une rétention : trente jours sont proposés, mais la fonction reste désactivée au départ. Le délai part de l’écartement et non de l’import.

Le passage automatique fonctionne environ une fois par heure lorsque les traitements de fond sont actifs. Il traite au plus deux cents images à la fois, après une sauvegarde vérifiée et protégée. Les références de projets et les fichiers encore utilisés sont conservés ; le dossier de dépôt et les reçus anti-doublons ne sont pas effacés. Une sauvegarde manquante ou invalide arrête le nettoyage. Désactiver le module Tri suspend imports automatiques et nettoyage ; le délai continue de passer et les images échues pourront être traitées après réactivation. L’aperçu local sans planificateur n’effectue pas ces suppressions automatiques.

## Fonctions, alertes et filtres

**Configuration → Fonctions** permet de masquer notamment le registre interne, l’agenda, le tri et le planning photo. Les API correspondantes sont également bloquées et les données conservées. Les demandes Google apparaissent avec leur compteur dans la barre supérieure de l’administration et mènent à **Équipe & accès**.

Dans les animaux, **Avec photos du refuge** filtre les vrais imports locaux. **À photographier** inclut les animaux dont seule la référence SPA est visible. Les cartes et la liste précisent cette origine ; **Tous les filtres** ouvre les critères détaillés.

Voir aussi [l’audience anonyme](AUDIENCE_ANONYME.md), [WhatsApp](WHATSAPP.md), [le partage public](PARTAGE_PUBLIC.md) et [la confidentialité](CONFIDENTIALITE.md).
