# Anipic 2.6.1 · Avatar de l’assistant

L’administrateur peut choisir l’image de l’assistant dans **Configuration → Avatar de l’assistant**. Un aperçu précède l’application ; le bouton et le panneau utilisent ensuite cette image. Retour à l’avatar par défaut en un clic.

- Import de JPG, PNG, WebP ou AVIF jusqu’à 5 Mo et 20 mégapixels.
- Recadrage carré automatique, correction d’orientation, WebP 512 px et suppression des métadonnées.
- Image persistante, incluse dans les sauvegardes et remplacée sans fichiers orphelins.
- Routes d’import et de remise à zéro réservées aux administrateurs, avec contrôle CSRF et origine.
- L’application de l’avatar conserve les autres réglages non enregistrés du formulaire.

Validation : compilation de production réussie ; 77 tests automatisés réussis, dont un cycle sauvegarde/restauration de l’avatar. Import, aperçu, application et retour au défaut vérifiés dans la démo web.

Conception et photographie : [Gaerisson](https://github.com/Gaerisson/). Développement assisté par **OpenAI Codex**.
