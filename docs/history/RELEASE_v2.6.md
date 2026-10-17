# 🦊 Anipic 2.6 — Photos, retouche et création pour le refuge

Anipic est la refonte de **GPIC SPA**, l’outil photo de Gaerisson pour le refuge SPA de Morée. Le projet rassemble la photothèque des animaux, les imports après Lightroom/Photoshop, le travail de l’équipe et la création de contenus dans une interface sombre personnalisable.

L’objectif : retrouver les bonnes photos, préparer les prochaines séances et créer des présentations, sans perdre les originaux ni confondre deux animaux portant le même nom.

## 📸 La photothèque

- Identité basée sur l’ID SPA : les homonymes et les changements de nom conservent leurs albums.
- Fiches avec grandes photos, zoom, navigation clavier, téléchargements JPEG/PNG/WebP et ZIP d’originaux.
- Import de fichiers ou dossiers, boîte privée **Photos à trier**, attribution par série et déduplication.
- Albums privés avec sous-dossiers, favoris, archives réversibles et import des anciennes photos.
- Photos de référence SPA grisées et signalées lorsqu’aucune photo locale n’est présente.

## ✨ Nouveau dans la version 2.6

### La retouche en direct

L’aperçu se rafraîchit pendant les réglages, avec le traitement des images dans un worker. Six presets sont proposés : **Neutre, Naturel, Glamour, Heure dorée, Cinéma et Noir & blanc**, avec intensité réglable.

Le mode avancé ajoute vibrance, teinte, détail, noirs mats, lumière diffuse et vignettage. Recadrage, comparaison avant/après, annuler/rétablir, rotation et miroir complètent les exports JPEG, PNG et WebP.

La retouche des photos de la bibliothèque est réservée aux **administrateurs**, dans l’interface et sur les routes serveur. Une variante enregistrée rejoint le tri privé ; l’original reste intact. Un fichier personnel peut être ouvert et exporté localement sans l’ajouter à la bibliothèque.

### Une interface remise en ordre

- Page **À propos** reconstruite : avatar GitHub de Gaerisson, relief discret au survol, services et cartes d’outils avec actions explicites.
- Panneau **Voix off** en trois étapes : préparer le texte, choisir/écouter, générer la piste audio.
- Boutons, icônes et téléchargements des films réorganisés pour les petites largeurs.
- Assistant déplacé dans la barre du haut, avec le renard de Gaerisson et le raccourci **Ctrl/⌘ K**. Les commandes d’enregistrement restent dégagées.

## 🎬 Créer et organiser

Le studio vidéo associe photos, clips, informations SPA, transitions, musique et narration. Il propose des presets, formats Story/publication/paysage, projets sauvegardés et exports MP4 avec Remotion. La musique et la voix disposent de réglages distincts.

Le connecteur Canva prépare des présentations éditables à partir d’un animal. Les publications Facebook disposent d’un texte et d’un visuel configurable. Gemini et Token Harbor peuvent aider à rédiger, et Mistral peut produire une voix off avec une clé serveur.

L’équipe dispose également d’un planning photo imprimable, d’outils de préparation, d’une météo pour Morée, de statistiques et d’un fil RSS. Les informations des animaux restent issues de la SPA : une disparition ne devient jamais automatiquement une adoption.

## 🐾 Connecteur SPA

Le connecteur lit le schéma JSON actuel et vérifie l’établissement, les IDs, la pagination et la stabilité de plusieurs passages. Le mode de lecture directe est limité à l’endpoint public SPA ; un mode strict et l’import JSON restent disponibles.

Dernier test réseau complet : **65 animaux, trois passages identiques et 16 requêtes source**, le 15 octobre 2026. Le diagnostic n’a pas remplacé les profils fictifs de la démo. Les collectes partielles et les baisses soudaines gardent leurs protections d’archivage.

## 🐳 Installation prévue pour Docker et Portainer

Node.js 24, React, Tailwind CSS 4, Fastify, SQLite, Sharp et Remotion. Originaux et sauvegardes sur le stockage monté ; SQLite et cache sur le disque local du serveur.

Après configuration de `.env` et des dossiers de stockage :

```sh
docker compose -f compose.yml up -d --build
docker compose -f compose.yml exec -it anipic npm run setup
```

Aucun compte administrateur par défaut. Les clés de services restent côté serveur ; aucune n’est incluse dans l’archive. Les émissions C8 et les services externes se raccordent selon votre installation.

## ✅ Vérifications

**74 tests automatisés réussis** sous Windows avec Node.js 24. Compilations du site réussies. Export PNG réel avec effets et recadrage : 1 200 × 1 500 px, sans EXIF. Contrôles des droits, de la conservation des originaux et des variantes privées.

Les API Canva/LLM/Mistral sont testées avec des transports simulés faute de clés réelles. Le connecteur SPA et les exports vidéo Remotion ont aussi été essayés réellement. Docker, Portainer, les montages NAS et la qualité des voix Mistral restent à valider sur l’installation cible. Le workflow GitHub Actions fourni n’a pas encore été exécuté en ligne.

## Crédits

**Gaerisson** — idée, conception, photographie et direction du projet.

Développement et refonte réalisés avec l’assistance d’**OpenAI Codex**.

Les services et bibliothèques utilisés conservent leurs conditions et licences respectives. Anipic est un outil indépendant ; la SPA fournit les informations des animaux.
