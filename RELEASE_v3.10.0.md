# AniPic 3.10.0 — Bénévoles, gazette, agenda partagé et suivi TV

- Inscription Google des bénévoles avec validation administrative et accès aux outils de création photo, vidéo et affiches.
- Exports d’affiches en série avec progression et gestion des gros lots ; suivi des affiches installées et à renouveler.
- Gazette automatique : résumé, arrivées, adoptions, portraits et dates clés, brouillons partagés, PDF/images et partage vers WhatsApp.
- Agenda partagé avec événements repris dans l’accueil, la gazette et la TV selon les choix de publication.
- Ententes en orange pour toute réponse renseignée autre que « Oui » ou « Non » seuls ; textes SPA conservés.
- Corrections des placements, thèmes clairs et petits écrans ; atelier simplifié.

## Suivi des écrans

Un onglet **Suivi des TV** rejoint la configuration de l’écran du refuge. Chaque navigateur ouvrant le lien TV s’inscrit automatiquement et peut être nommé. Les cartes indiquent la connexion, le dernier contact, l’actualisation du programme, les réglages reçus, la séquence en cours, la pause et le mode plein écran.

Les erreurs d’image ou de vidéo, le démarrage vidéo bloqué et l’absence de progression remontent avec un historique daté des incidents et reprises. Un écran silencieux depuis plus de 75 secondes est signalé hors ligne. Les aperçus AniPic ne sont pas comptés comme des TV.

Administration et agents SPA peuvent consulter, renommer ou retirer un écran du suivi. Le retrait ne coupe pas sa lecture ; le suivi se réactive depuis les commandes de la TV. Le PIN et les droits existants sont conservés, les identités persistent par navigateur et aucun service externe n’est utilisé.

Migration SQLite additive **20 → 21** ; montages Docker, originaux et données existantes conservés.

## Livraison Docker et GitHub

Images locales alignées sur **3.10.0**, configuration supplémentaire `portainer-ghcr.yml` pour `ghcr.io/gaerisson/anipic:3.10.0`, avec les mêmes données et montages. La publication attend les tests, les builds frontend/vidéo, la construction Docker et son contrôle de rendu réel. Le contrôle des bind mounts accepte les sorties JSON Compose v2/v5 sans autoriser de création implicite de dossiers NAS.

La release contient les sources ZIP, leur somme SHA-256 et le digest de l’image Linux amd64. Les anciennes notes sont regroupées dans `docs/history/`. Aucun volume n’est supprimé ou réinitialisé. Consulter les résultats du workflow pour le commit exact ; le NAS, Portainer et la TV de l’installation restent à vérifier sur place.

[Mode d’emploi et limites](docs/SUIVI_TV.md) · [Vérifications](VALIDATION.md) · [Installation Docker](docs/DEPLOIEMENT.md).

© Gaerisson.
