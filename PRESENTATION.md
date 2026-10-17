# Présentation AniPic 3.2

Montage court de **24,5 secondes** en story 1080 × 1920 et paysage 1920 × 1080, H.264/AAC, 30 images/s. Portraits en relief, photothèque, retouche en direct, affiches, studio vidéo et programmation TV. Aucune vue de l’ancien GPIC dans ce montage. La signature finale indique le dépôt et Gaerisson × Codex.

La grille est issue d’une analyse des transitoires du fichier fourni : période **0,6122 s**, environ **98 BPM**, extrait à partir de **10,2922 s**, 40 temps. Les changements de scène suivent les temps 0 / 4 / 10 / 16 / 22 / 28 / 34 / 40. Le son et l’image se fondent en début/fin.

```sh
npm run video:build
npm run video:browser
node scripts/render-showcase.mjs --music "/chemin/Borderline.mp3" --period 0.6122 --start 10.2922 --output ./docs/media
```

`--stills-only` génère les images de contrôle. Sans `--music`, le montage est silencieux. Le script lit la musique locale, découpe un extrait temporaire et le supprime après préparation ; le fichier original n’est pas copié dans le projet. La composition `ToolShowcase` et les captures `public/presentation-v32/` restent éditables.

Musique de cette présentation : **Tame Impala — Borderline**, fichier fourni par Gaerisson. Cette musique n’est pas présentée comme libre de droits ; elle ne fait pas partie du catalogue libre du studio. Les anciennes scènes GPIC ont été retirées. Les commandes `npm run video:story` et `npm run video:trailer` utilisent désormais ce même montage actuel en portrait ; elles acceptent toujours un chemin MP4 en premier argument. Pour choisir un format : `node scripts/render-showcase.mjs --format portrait` ou `--format landscape`.
