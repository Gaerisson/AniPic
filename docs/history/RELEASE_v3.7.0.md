# AniPic 3.7.0 — Atelier photo et gazette du refuge

Quatre outils regroupés dans **Outils de l’équipe** :

- Assistant de tri : références SPA et photos locales, indices de netteté/exposition/définition, prises ressemblantes et choix manuels mémorisés, sans suppression automatique.
- Détourage local avec BiRefNet : aperçu transparent, comparaison à l’original, réglages du contour, fonds unis et export PNG ou copie dans AniPic.
- Suivi des affiches réellement imprimées/installées dans les box, emplacements, dates, intervenants et alertes après modification d’une fiche ou d’une photo.
- Gazette mensuelle A4 en trois styles : portraits, adoptions enregistrées, événements et textes de l’équipe, brouillons partagés, aperçu et PDF.

Chargements et progression visibles, suivi repris en revenant à l’outil, erreurs SPA explicites, aperçus privés et originaux conservés.

Migration SQLite 19 additive. Montages Docker/Compose inchangés. Nouvelle dépendance de calcul CPU installée par npm, lockfile régénéré ; le smoke test de l’image vérifie également le moteur ONNX. Le modèle de détourage est téléchargé au premier usage (192 Mo), reste dans `/cache` et demande environ 4 Go de RAM alloués avec au moins 3 Gio disponibles ; le lancement est refusé si cette marge manque.

[Mode d’emploi et limites](../ATELIER_REFUGE.md) · [Vérifications réellement exécutées](../../VALIDATION.md) · [Installation](../DEPLOIEMENT.md)

© Gaerisson. Aucun déploiement Portainer ni publication GitHub n’est effectué par cette release locale.
