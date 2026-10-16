# API médias et diffusion · 3.0

Toutes les écritures demandent une session autorisée, l’origine de l’application et `X-CSRF-Token`. UUID validés ; aucun chemin de disque n’est accepté dans ces requêtes. Rôles : admin, editor (photographe), agent, viewer (lecture).

| Route | Accès | Objet |
|---|---|---|
| GET `/api/media-tags` | équipe | Catalogue de thèmes |
| GET `/api/media-tags/:kind/:id` | équipe | Tags d’une photo ou vidéo |
| PUT `/api/media-tags/:kind/:id` | admin/editor/agent | `{tags:["Halloween","Noël"]}` ; 20 maximum |
| GET `/api/animals?mediaTag=Noël` | équipe | Filtre de bibliothèque avant pagination |
| GET `/api/animals/:id/videos` | équipe | Vidéos associées, légendes et tags |
| POST `/api/animals/:id/videos` | admin/editor/agent | `{assetId,caption?}` ; privée par défaut |
| PATCH `/api/animal-videos/:id` | admin/editor/agent | `{caption,showOnTv}` |
| DELETE `/api/animal-videos/:id` | admin/editor/agent | Détache sans supprimer le fichier |
| GET `/api/admin/display` | admin | Réglages de diffusion |
| PUT `/api/admin/display` | admin | Enregistre les réglages et `displayProgram` |
| POST `/api/admin/display/preview` | admin | Aperçu d’un formulaire non enregistré |
| GET `/api/public/display` | public si activé | Programme et médias publics éligibles, sans hash ni détails internes |
| GET `/api/public/animal-videos/:id/file` | public si éligible | Lecture vidéo avec Range et contrôle actuel des exclusions |
| POST `/api/motion/preview` | équipe | `{program,hiddenIds?,title?}` |
| POST `/api/motion/render` | admin/editor/agent | Même corps ; retourne `id` du job et `renderId` |
| GET `/api/motion/exports` | équipe | État/progression, y compris les entrées `removed` récupérables |
| POST `/api/motion/exports/:id/cancel` | admin/editor/agent | Annule un rendu en cours |
| DELETE `/api/motion/exports/:id` | admin/editor/agent | Place dans la corbeille |
| POST `/api/motion/exports/:id/restore` | admin/editor/agent | Restaure une entrée de corbeille |
| GET `/api/motion/exports/:id/file` | équipe | MP4 terminé, Range ; `?download=1` pour télécharger |

`kind` vaut `photo` ou `video`. Pour une vidéo, l’ID des tags est celui du média du studio (`asset_id`), tandis que l’URL TV utilise l’ID du lien `animal_videos`. L’import binaire conserve la route privée existante POST `/api/video/assets?kind=video`, multipart fichier unique, 100 Mo maximum, conteneur vérifié.

Le schéma complet de programme est `server/signage-schema.mjs`, ses valeurs initiales `shared/signage.mjs`. Format des affiches : POST `/api/animals/:id/poster` avec `photoId`, `template` (`spa`, `editorial`, `glass`, `contrast`), `paper` (`a4`,`a5`), `format` (`pdf`,`png`,`preview`), `showQr`, `showCompatibility`, `focusX`, `focusY`. L’API impose l’appartenance de la photo à l’animal.
