# Compter les consultations sans suivi individuel

AniPic propose un compteur local de consultations indépendant du suivi détaillé soumis au consentement. Il est activé par défaut et peut être désactivé dans **Administration → Visiteurs**. Il ne permet pas de connaître le nombre de personnes différentes.

## Données conservées

La table `audience_daily` contient uniquement une date à Paris, une catégorie de page issue d’une liste bornée et un total. Aucun identifiant, IP, compte, agent utilisateur, recherche, référence d’animal ou jeton de partage n’y est enregistré. Il n’y a ni cookie de mesure, stockage navigateur d’identifiant, suivi de parcours ou transfert à un prestataire. Le navigateur envoie une catégorie sans ses cookies ni son référent ; les totaux sont conservés 90 jours.

Une consultation correspond à une page affichée, pas à un visiteur unique ni à une session. Les retours sur une rubrique sont de nouvelles consultations ; rester sur la même page n’ajoute pas de battement périodique. Ces compteurs ne sont pas une mesure antifraude ou un recensement exhaustif des robots.

## Choix des visiteurs

La page Confidentialité et les choix de cookies permettent de refuser ce comptage. Seule une préférence non identifiante est alors mémorisée. Le signal GPC est respecté. Le suivi détaillé existant (IP, comptes, sessions, navigateur) reste distinct et désactivé sans accord ; ses anciennes données ne sont pas transformées en agrégats rétroactifs.

Les requêtes anonymes ne créent ni connexion automatique de réseau, ni autorisation PIN, ni appareil connecté. Les totaux sont consultables uniquement par l’administration. Les journaux techniques de sécurité et la limitation de débit du service restent des traitements séparés ; les requêtes de comptage réussies ne créent pas de ligne dans le journal des accès.

## Cadre et limites

La [CNIL décrit les conditions d’exemption de consentement pour la mesure d’audience](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience) : finalité limitée au service de l’éditeur, statistiques anonymes, absence de recoupement et de suivi entre sites, information et durées limitées. Ce compteur est conçu pour réduire les données à ces totaux locaux. Ce document décrit le fonctionnement livré ; il ne vaut pas certification CNIL ni validation des journaux, prestataires ou modifications propres à chaque hébergement. L’exploitant doit compléter ses coordonnées et sa politique de confidentialité.
