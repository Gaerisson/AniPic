# Confidentialité et mise en service

Chaque installation dispose de ses pages `/#legal`, `/#terms` et `/#privacy`, accessibles avant le PIN. Dans **Réglages → Mentions et confidentialité**, son administrateur renseigne la structure, son adresse, son contact, le responsable de publication et les coordonnées de l’hébergeur. L’attribution du logiciel reste **© Gaerisson**. Les coordonnées du refuge ne sont pas inscrites dans les sources publiques.

Ces pages et protections constituent une base technique : publier le code sur GitHub ne rend pas une installation automatiquement conforme. Avant ouverture au public, l’exploitant doit compléter ses mentions, déterminer ses bases légales, informer son équipe, fixer les durées utiles, vérifier les droits des photos et les contrats des services activés. Les champs non renseignés sont signalés ; aucune identité d’exploitant n’est inventée.

## Cookies et statistiques

- La fréquentation facultative est **désactivée par défaut**, côté serveur. L’administrateur peut proposer cette mesure ; un bandeau demande alors le choix individuel.
- Accepter et refuser sont accessibles au même niveau. Aucun refus ne supprime l’accès, le compte ou le PIN. **Cookies**, dans le pied de page, permet de changer de choix.
- Le choix signé est conservé 180 jours. Un reçu sans IP ni compte, contenant la décision, sa version et sa date, permet d’en documenter la collecte ; il expire après 180 jours. Une valeur falsifiée ou expirée n’autorise rien.
- `/api/visit` n’enregistre aucune visite sans activation administrative et consentement signé. `Sec-GPC: 1` est également respecté. Les visites consenties sont conservées au maximum 30 jours (durée abaissable dans les réglages). Leur GeoIP utilise la base locale configurée.
- Les cookies nécessaires à la connexion, à la sécurité et aux choix d’interface ont leur propre fonctionnement. Les journaux de sécurité sont distincts des visites et leur durée est configurable de 1 à 90 jours, avec un plafond de 10 000 accès. Les visites refusées ne sont pas consignées dans ce journal comme une fréquentation indirecte.

Un proxy, un outil de statistiques ou une intégration ajoutée en dehors d’AniPic doit être audité séparément : le consentement AniPic ne configure pas ces services.

## Comptes, données internes et tiers

**Compte & appareils** affiche les connexions actives et permet de les révoquer. L’export personnel est disponible sur cette page. Les sessions inactives expirent après 90 jours ; une session utilisée se renouvelle avant son échéance. Le PIN est une permission de navigateur révocable, pas un compte d’équipe. Les préférences de notification sont initialement désactivées ; chaque appareil doit être autorisé explicitement.

Les présences, notes, brouillons et albums internes restent soumis aux rôles. Les propositions de rédaction n’écrasent pas les fiches SPA. Le planning, les comptes et les sauvegardes doivent faire l’objet d’une politique de conservation définie par l’exploitant ; les mises à jour ne détruisent pas les volumes NAS. Pour une demande d’effacement, celui-ci doit identifier les données concernées et ses éventuelles obligations de conservation, puis traiter aussi le cycle des sauvegardes.

Google, Canva, le prestataire IA configuré et les services push des navigateurs interviennent seulement pour leurs fonctions respectives. Documenter les destinataires, lieux de traitement et garanties de transfert avant activation. Ne pas transmettre de renseignements personnels inutiles à un LLM. Une page d’information ou un bandeau cookies ne remplace pas le registre des traitements, la gestion des habilitations et la procédure de réponse aux droits ou incidents.

## Références officielles consultées le 21 octobre 2026

- [CNIL : information et transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence) pour structurer l’information sur les finalités, destinataires et droits.
- [CNIL : règles sur les cookies](https://cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi) pour les cookies nécessaires et le consentement facultatif.
- [CNIL : questions sur le consentement et sa preuve](https://cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ) pour la conservation du choix et la possibilité de le démontrer.
- [CNIL : durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees) pour les durées adaptées à chaque finalité.
- [CNIL : exercer ses droits](https://www.cnil.fr/fr/passer-laction/les-droits-des-personnes-sur-leurs-donnees).

Les choix applicables dépendent de l’exploitant et de ses usages. Ces documents ne constituent pas une certification de conformité juridique.
