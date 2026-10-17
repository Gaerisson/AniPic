# AniPic 3.10.0 — Suivi des écrans TV

Un onglet **Suivi des TV** rejoint la configuration de l’écran du refuge. Chaque navigateur ouvrant le lien TV s’inscrit automatiquement et peut être nommé. Les cartes indiquent la connexion, le dernier contact, l’actualisation du programme, les réglages reçus, la séquence en cours, la pause et le mode plein écran.

Les erreurs d’image ou de vidéo, le démarrage vidéo bloqué et l’absence de progression remontent avec un historique daté des incidents et reprises. Un écran silencieux depuis plus de 75 secondes est signalé hors ligne. Les aperçus AniPic ne sont pas comptés comme des TV.

Administration et agents SPA peuvent consulter, renommer ou retirer un écran du suivi. Le retrait ne coupe pas sa lecture ; le suivi se réactive depuis les commandes de la TV. Le PIN et les droits existants sont conservés, les identités persistent par navigateur et aucun service externe n’est utilisé.

Migration SQLite additive **20 → 21** ; montages Docker, originaux et données existantes conservés.

[Mode d’emploi et limites](docs/SUIVI_TV.md) · [Vérifications](VALIDATION.md) · [Installation Docker](docs/DEPLOIEMENT.md).

© Gaerisson.
