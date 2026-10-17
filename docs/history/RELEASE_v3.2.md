# AniPic 3.2 — Photo, création et diffusion

AniPic accompagne le travail photo du refuge : importer les séries après Lightroom/Photoshop, les attribuer au bon animal, préparer les priorités, créer des supports et diffuser les portraits sur la TV de l’accueil.

Cette version ajoute les dates des séries et une comparaison indicative avec la photo principale SPA, une timeline TV déplaçable et redimensionnable, le renouvellement des animaux, les messages saisonniers, les affiches en série, les bannières, les widgets d’accueil, le PIN optionnel et la connexion agent par IP. Le tableau visiteurs affiche les drapeaux et la localisation GeoIP locale. Le logo AniPic et les présentations commerciales sont renouvelés.

[Détail des nouveautés](NOUVEAUTES_V32.md) · [Installation Docker et Portainer](../DEPLOIEMENT.md) · [Validation et limites](../../VALIDATION.md)

Les bases existantes migrent vers le schéma 14 sans réinitialiser les animaux, photos ou projets. Sauvegarder l’installation avant une mise à jour. Une nouvelle installation de production est vide ; les profils fictifs restent dans la démo séparée.

Code, besoins et direction : **Gaerisson**. Projet **vibecodé avec Codex, assistant d’OpenAI**, puis vérifié par tests automatisés et contrôles visuels. Les services nécessitant une clé restent optionnels.

© 2026 Gaerisson. Les marques, le logo et les informations SPA restent la propriété de leurs titulaires.
