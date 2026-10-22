# AniPic 3.15 — Des ateliers plus simples, des créations plus soignées

Le redimensionnement Canvas conserve désormais les proportions par défaut, avec un lien largeur/hauteur visible et désactivable. Les poignées latérales sont masquées lorsque les dimensions sont liées, pour éviter une déformation accidentelle. Les dimensions se valident avec Entrée ou en quittant le champ.

- **Neuf modèles de bannières** : éditorial SPA, verre boréal, duo, magazine, contraste, événement, minimal, nature et saison. Deux portraits trouvent automatiquement leur place dans le modèle duo. Les repères disparaissent à l’insertion d’une photo.
- **Visuels & bannières** utilise le même atelier avec cadre, formes, textes, calques et exports que Canvas. Les outils historiques restent accessibles dans **Duo & détourage** et **Mosaïques & fonds d’écran**.
- **Outils de l’équipe** : trois rubriques pour les prénoms, l’organisation et la météo ; accès utiles regroupés et résultats des prénoms mis en avant.
- **Liquid glass** : galerie de portraits sur panneaux translucides, noms lisibles et mouvement lent ; les portraits ne pivotent plus en 3D dans ce style. Les présentations restent adaptées aux deux orientations et au mouvement réduit.
- **Rédaction** : correction de la détection des mots répétés avec accents, notamment le faux positif dans « sécurité émotionnelle ». La règle « espace avant une virgule ou un point » est retirée. Les émojis des rubriques d’entente sont placés avant leur libellé.
- **Suivi des TV** : retrait uniquement hors ligne, puis réapparition automatique avec la même identité au retour de l’écran. Son nom et sa configuration restent conservés.
- **Sauvegardes** : conservation configurable en jours et suppression manuelle avec confirmation. Le nettoyage automatique préserve le dernier point de restauration et les archives protégées pour leurs originaux. La durée par défaut est 0, sans limite d’âge ; la limite existante du nombre de copies reste applicable.
- **Synchronisation SPA** : une erreur DNS temporaire `EAI_AGAIN` déclenche jusqu’à deux nouvelles tentatives sur la même requête, dans les budgets existants. Un échec persistant ou un inventaire incomplet continue de suspendre l’archivage. Les arrivées et modifications reçues restent importées sans supprimer les fiches et les photos existantes.

Les fichiers Compose conservent leurs volumes et montages. Mettre à jour la stack existante. L’APK native reste en 3.14.0 : ces changements web sont également disponibles dans Android après mise à jour du serveur.

Les essais réels, simulations et limites sont détaillés dans [VALIDATION.md](VALIDATION.md). Aucun déploiement ni nettoyage de sauvegarde n’a été effectué sur le NAS de production.
