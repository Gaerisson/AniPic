# Anipic 2.6

## Retoucher

Ouvrir un fichier dans **Éditeur photo**, ou utiliser **Retoucher cette photo** depuis une fiche avec un compte administrateur. Les comptes agent/photographe/lecteur ne disposent pas de la retouche des photos de la bibliothèque. Ils peuvent toujours télécharger les fichiers selon leurs droits existants ; ce contrôle porte sur la retouche dans Anipic, pas sur les applications externes.

Les six presets ont une intensité réglable. Un preset change les réglages de couleur et d’effets sans déplacer le cadre, tourner ou retourner l’image. Un réglage manuel passe en mode personnalisé. **Réinitialiser** revient au neutre et au cadre complet. Le mode avancé révèle vibrance, teinte, détail, noirs mats, Glamour et vignettage avec étendue réglable.

L’aperçu ne patiente plus jusqu’à la fin du déplacement d’un curseur. Il traite un rendu à la fois, conserve le dernier réglage demandé et affiche les résultats successifs. Le traitement se fait hors du fil principal si le navigateur prend en charge les workers et OffscreenCanvas. L’export utilise la définition originale et le même calcul d’effets.

Sur ordinateur, l’image reste visible pendant le défilement des réglages. Sur téléphone, un aperçu compact conserve de la place pour les commandes. Les originaux sont immuables ; **Enregistrer dans Photos à trier** crée une variante privée. Les variantes d’une photo de bibliothèque passent par une route administrateur et une entrée de journal liée à la photo source.

Les limites existantes restent appliquées : JPEG/PNG/WebP/AVIF, 30 Mo et 40 mégapixels à l’ouverture ; limite serveur à l’enregistrement ; aucun RAW, calque PSD ou masque. Les réglages ne sont pas des projets persistants tant qu’ils ne sont pas exportés.

## Interface

La page À propos utilise l’avatar public du GitHub Gaerisson, intégré au projet pour éviter une requête externe à chaque affichage. Son relief au survol est limité à cinq degrés et respecte la réduction des mouvements. Les outils ont des cartes avec actions et flèches explicites ; le lien Voix off ouvre directement le bon panneau du studio.

La voix off suit trois étapes, avec boutons sur des lignes distinctes et un texte qui reste dans leur cadre. L’aperçu vocal de l’appareil peut être arrêté. Il utilise une voix française disponible et ne fait pas partie de l’export. Mistral reste un connecteur serveur à configurer, décrit dans [le guide V2.5](NOUVEAUTES_V25.md).

L’assistant est dans la barre du haut, avec le renard de Gaerisson. Il n’occupe plus le coin des boutons d’enregistrement. Raccourci Ctrl/⌘ K, fermeture par Échap ou clic à l’extérieur, recherche locale et IA facultative restent disponibles.

## Livraison GitHub

[Texte de release prêt à publier](RELEASE_v2.6.md), crédits Gaerisson/OpenAI Codex et workflow CI fournis. L’archive exclut les clés `.env`, la base, les photos privées, les caches, les sauvegardes et `node_modules`. La publication effective dépend du dépôt GitHub choisi par l’utilisateur ; aucun dépôt distant n’est associé au dossier au moment de cette préparation.
