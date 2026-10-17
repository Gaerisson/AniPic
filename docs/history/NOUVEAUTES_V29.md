# Anipic 2.9 — photos, communication et diffusion

## Où trouver les nouveautés

| Fonction                                 | Accès                                                            |
| ---------------------------------------- | ---------------------------------------------------------------- |
| Import Lightroom / Photoshop automatique | Administration → API & connexions → Import Lightroom / Photoshop |
| Suggestions d’attribution d’un lot       | Photos à trier → sélectionner → Attribuer à un animal            |
| Commentaires avec point sur la photo     | Fiche animal → Commentaires de l’équipe → Pointer une zone       |
| Affiche A4 et pack de communication      | Fiche animal → Affiche & pack communication                      |
| Case « Publié »                          | Fiche animal ; filtre Mise en avant dans les listes              |
| Écran TV et animaux masqués              | Administration → Écran du refuge                                 |
| Historique détaillé                      | Le refuge → Historique SPA, ou depuis une fiche                  |
| Photos similaires                        | Administration → Stockage → Photos similaires                    |
| Sous-titres éditables et SRT             | Studio vidéo → Sous-titres                                       |

## Exporter depuis Lightroom

Le service de publication vers un disque de Lightroom Classic peut écrire dans un dossier partagé du NAS. Photoshop peut enregistrer ses exports JPEG dans ce même dossier. Anipic lit les images fixes JPEG, PNG, WebP et AVIF ; le traitement RAW reste dans Lightroom/Photoshop.

1. Raccorder le dossier en lecture seule avec `ANIPIC_IMPORT_PATH` et `compose.import.yml`. Hors Docker, utiliser `IMPORT_DIR`.
2. Dans API & connexions, activer Lecture automatique et choisir l’intervalle en minutes ainsi que le délai après écriture. Par défaut : désactivé, 5 minutes, 10 secondes. Les fichiers récemment écrits sont ignorés jusqu’à une prochaine lecture. Le NAS doit être accessible par le processus du serveur.
3. Publier par exemple dans `Chiens/Nala__216822`. La fiche animal propose un bouton pour copier un nom de dossier comprenant le nom et l’identifiant source.
4. Ouvrir Photos à trier, sélectionner la série puis vérifier le portrait, l’espèce et l’ID de la suggestion. Les homonymes restent des choix distincts. L’attribution exige une validation ; aucune reconnaissance automatique d’un animal sur son image n’est prétendue.
5. Facultatif : mémoriser le dossier pour les prochaines suggestions. Même dans ce cas, chaque attribution reste à confirmer. Les photos sont privées par défaut après attribution.

Le lecteur ne déplace ni ne supprime les exports d’origine. Les empreintes SHA-256 évitent de stocker plusieurs copies identiques. Les reçus de lecture évitent de réimporter un fichier inchangé après son attribution. Les lots sont limités à 100 fichiers traités par passage, 10 000 entrées explorées et six niveaux de dossiers. Les autres fichiers sont repris au passage suivant. Les erreurs du NAS ne suppriment aucune photo.

La boîte de tri se rafraîchit toutes les 15 secondes quand elle est visible et raccordée à un dossier. Les tâches planifiées sont volontairement désactivées dans la démo locale ; le bouton de lecture manuelle reste disponible si un dossier y est configuré.

[Documentation Adobe sur la publication vers un disque](https://helpx.adobe.com/lightroom-classic/desktop/export-photos/export-hard-drive-using-publish.html).

## Commentaires et mise en avant

Les agents, photographes et administrateurs peuvent commenter une photo et placer un repère sur une zone. Le texte, l’auteur, la date et l’état résolu restent internes. Seuls l’auteur ou un administrateur peuvent modifier le texte ou supprimer le commentaire. Un lecteur peut consulter les commentaires sans les modifier. Les annotations ne sont pas gravées dans l’original.

La case **Publié** conserve une date de mise en avant, affichée discrètement sur la carte. Le filtre permet de retrouver les animaux déjà publiés ou à présenter. Cocher ne poste rien sur Facebook et télécharger un pack ne coche pas cette case automatiquement. Les informations SPA restent en lecture seule ; ces éléments sont des informations de travail distinctes.

## Affiche et pack de communication

Premier modèle **A4 portrait, 210 × 297 mm**, avec photo locale, logo SPA, nom, faits renseignés, courte présentation, ententes et QR vers la fiche officielle quand elle est disponible. Le modèle est provisoire en attendant le visuel du refuge. A5 portrait proposé aussi. Couleur, couverture, cadrage, ententes et QR réglables, avec aperçu.

- PDF : dimensions physiques du papier conservées.
- PNG A4 : 2480 × 3508 pixels, densité 300 dpi ; A5 : 1748 × 2480 pixels.
- Pack ZIP : jusqu’à huit photos web JPEG, visuels Facebook 1080 × 1350 et story 1080 × 1920, texte de présentation issu des faits SPA, affiche A4 et notice. Les aperçus du cache ne sont pas inclus.

Les titres et paragraphes longs sont abrégés pour conserver la lisibilité. Les faits ne sont pas édités dans ce panneau. Le générateur utilise une photo locale choisie sur la fiche. Les lecteurs connectés peuvent exporter l’affiche ; le pack complet demande un rôle agent, photographe ou administrateur. Les exports graphiques retirent les métadonnées EXIF des photos.

Exemple fictif : [PDF A4](../examples/affiche-a4.pdf) · [Aperçu](../examples/affiche-a4.png).

## Écran du refuge

Le réglage est enregistré côté serveur. L’écran est désactivé par défaut. Choisir la durée (5 à 60 secondes), les animaux masqués, l’inclusion des réservés et l’usage éventuel des photos de référence SPA. Puis ouvrir l’écran sur le navigateur du téléviseur et activer le plein écran.

L’écran sélectionne uniquement des photos publiques locales ; les références SPA sont facultatives et identifiées. Les animaux archivés, adoptés ou absents sont exclus. Les notes, messages, commentaires, originaux et le suivi « publié » ne sont pas envoyés à cet écran. Sa sélection se recharge chaque minute. Espace met en pause, les flèches changent d’animal ; le défilement s’arrête sur un onglet masqué.

## Historique SPA et API publique

Le suivi enregistre la valeur avant/après des champs publics normalisés : nom, espèce, sexe, naissance, race, présentation, statut, ententes, tags, lien et informations complémentaires filtrées. Un import identique ne produit aucun doublon. L’état initial est marqué **baseline** : il représente le moment d’activation du suivi, pas la date d’une modification ancienne. Les textes passés qui n’étaient pas enregistrés ne peuvent pas être reconstitués.

`GET /api/public/changes` est public et activable dans Administration → Écran du refuge → Historique public. Il est actif par défaut pour les faits déjà publics de la SPA. Les commentaires, comptes, messages et données internes n’y figurent pas. CORS en lecture sans identifiants, ETag, cache 30 secondes et limite de 60 requêtes/minute/IP.

Paramètres : `after` (curseur numérique exclusif, défaut 0), `limit` (1–100, défaut 40), `animalId` (UUID local), `sourceId`, `field`, `since` (date ISO), `baseline=1` pour inclure les états initiaux. L’ordre est croissant pour permettre un suivi incrémental. `next` vaut le dernier curseur quand une autre page existe, sinon `null`. Pour un suivi régulier, conserver le plus grand `seq` reçu, même si `next` est `null`.

```sh
curl 'https://votre-domaine/api/public/changes?after=0&limit=40&field=status'
```

```json
{
  "schemaVersion": 1,
  "items": [
    {
      "seq": 42,
      "animal_id": "UUID",
      "kind": "updated",
      "field": "status",
      "before": "available",
      "after": "reserved",
      "observed_at": "2026-10-16T10:00:00.000Z",
      "name": "Nom SPA",
      "species": "dog",
      "source_id": "spa:216822",
      "source_url": "https://www.la-spa.fr/animal/..."
    }
  ],
  "next": null,
  "trackingSince": "2026-10-16T09:00:00.000Z"
}
```

Une absence confirmée garde le statut `source_missing`. Elle ne devient pas une adoption. Le flux RSS existant reste disponible pour les événements d’arrivée, départ et retour.

## Photos proches et sous-titres

L’analyse compare des empreintes visuelles des 1 500 images actives les plus récentes, avec cache des empreintes. Trois sensibilités, aperçu côte à côte, liens vers les fiches et possibilité d’ignorer un rapprochement. Résultat limité à 100 paires par analyse. Les cadrages fortement différents peuvent être manqués ; deux images différentes peuvent se ressembler. **Aucune suppression automatique.** Les doublons parfaitement identiques restent gérés par SHA-256. Le nettoyage du cache existant libère les aperçus sans toucher aux originaux.

Le studio conserve les sous-titres dans le projet : texte, début/fin, style et position. Import/export SRT, ajout manuel et incrustation dans le MP4. Les segments ne doivent ni se chevaucher ni dépasser le film ; maximum 500 segments et 10 minutes. Le texte de voix off est désormais enregistré avec le montage.

Sans service externe, le texte de voix off donne un minutage **estimé**, à ajuster après écoute. Avec `MISTRAL_API_KEY`, le bouton de transcription peut envoyer explicitement une piste au service [Mistral Transcriptions](https://docs.mistral.ai/studio/audio/speech_to_text/offline_transcription). Modèle réglable avec `MISTRAL_STT_MODEL` (défaut `voxtral-mini-latest`). Le serveur extrait l’audio localement avec le FFmpeg livré par Remotion, ou `FFMPEG_PATH`, en mono 16 kHz et le fichier temporaire est retiré. Pas d’envoi automatique, pas de clé dans le navigateur. Relire les noms propres. Pour un clip découpé, ajuster les temps relatifs au fichier source.

## Mise à jour

Sauvegarder la base et les médias avant remplacement. La migration SQLite v10 ajoute les tables ; elle ne réinitialise ni animaux, ni photos, ni projets, ni réglages. Les exemples de ce guide sont fictifs. L’installation de production ne lance pas le seed de démonstration.

Le paquet inclut les sources, les fichiers compilés et la composition Remotion. Les bibliothèques QR et PDF sont verrouillées dans `package-lock.json`. La dépendance de compilation `tapable` est fixée à la version 2.3.3 déjà utilisée et vérifiée par le projet.
