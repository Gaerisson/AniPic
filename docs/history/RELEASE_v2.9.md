# Anipic 2.9 — de l’export photo à la diffusion

Après un export Lightroom ou Photoshop dans un dossier partagé, Anipic peut détecter les nouvelles images, les placer dans la boîte de tri et suggérer le bon animal avec son portrait et son ID SPA. L’attribution reste confirmée par l’équipe, y compris pour les homonymes.

Cette version ajoute les commentaires avec repère sur les photos, le suivi interne « Publié », les affichettes A4 portrait et les packs de communication, un écran TV avec liste d’exclusion, l’historique détaillé des changements SPA et son API publique. Le stockage dispose d’une comparaison des photos proches ; le studio enregistre des sous-titres éditables, importe/exporte le SRT et peut transcrire une piste avec Mistral en option.

Les nouveautés utilisent les couleurs et les surfaces du thème existant. Les panneaux restent repliables ; les commentaires et autres informations de travail restent internes. La migration conserve les données et les projets existants. L’écran TV et la lecture automatique du dossier sont désactivés par défaut.

Voir le [guide d’utilisation](NOUVEAUTES_V29.md), l’[exemple d’affiche](../examples/affiche-a4.pdf) et les [vérifications](../../VALIDATION.md). Le modèle d’affiche sera adapté au visuel du refuge lorsqu’il sera fourni. Le dossier NAS et les services authentifiés sont à configurer sur l’installation cible. La validation Windows ne constitue pas un déploiement Docker/NAS. La transcription Mistral a été contrôlée avec un transport simulé ; aucun appel facturé n’a été effectué sans clé réelle.

**Conception et photographie : [Gaerisson](https://github.com/Gaerisson/). Développement assisté par OpenAI Codex.** Le nom et le logo SPA restent la propriété de leurs titulaires.
