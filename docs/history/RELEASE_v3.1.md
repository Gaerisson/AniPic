# Anipic 3.1 · Programme TV, création et suivi

La TV de l’accueil dispose désormais d’une timeline : on choisit où insérer un clip, un message saisonnier, une séquence logo ou des statistiques. Un interrupteur désactive toutes les statistiques et un lien web permet de lire le programme en boucle sur le téléviseur.

## Dans cette version

- Timeline TV avec positions, durées, messages Halloween / Noël / été, aperçu par séquence et clip du studio. Le média choisi devient public uniquement quand l’administration enregistre un programme activé qui le référence.
- Bilan annuel plus animé : portraits en relief, noms, mosaïque qui se rassemble, puis dévoilement du logo SPA et compteurs issus des données enregistrées.
- Fonds animés et réseaux : formation du logo, mouvement 3D et rythme dynamique sélectionnable.
- Titres de fenêtres et barre de sélection transparents ; navigation regroupée dans des catégories repliables.
- Fil du refuge et historique dans le même espace, couleurs différentes pour arrivées, adoptions, archives et retours.
- Visiteurs : consultations, sessions estimées, IP, compte connecté, navigateur et système. Pays via proxy de confiance configuré. Accès réservé aux administrateurs, conservation 30 jours.
- Messages d’équipe en popup avec bouton Lu, report possible et consultation depuis l’assistant.
- Configuration Mistral dans l’interface : clé serveur, modèles et voix par défaut. Paramètres exportables en JSON sans clés, comptes ni médias.
- Bouton « Créer l’affiche de box » sur la fiche ; QR visible aussi dans les aperçus et les portraits vidéo. Repli vers la page du refuge si le lien individuel SPA est absent.
- Présentation de 19,6 s en story et paysage, synchronisée sur l’extrait musical fourni.

## Installation et validation

Migration additive **11 → 12**, pour le suivi des consultations. Aucun remplacement des photos, animaux, comptes ou projets. Recompiler l’interface et les compositions vidéo après mise à jour. La production ne charge pas les profils de démonstration.

**111 tests locaux réussis.** Rendus MP4 réels : story 1080 × 1920 et paysage 1920 × 1080, 30 images/s ; bilan portrait 720 × 1280 ; fond animé 1280 × 720. Quatre affichettes A4 rendues et inspectées. L’image Docker et le téléviseur physique restent à valider sur le matériel de déploiement.

## Crédits

Projet **vibecodé par Gaerisson avec Codex, assistant d’OpenAI**. Direction, idée et besoins métier : Gaerisson. Logo / charte : La SPA. Présentation musicale : extrait de **Borderline — Tame Impala**, fourni par Gaerisson ; le fichier audio original n’est pas inclus. Les bibliothèques et leurs licences sont conservées.
