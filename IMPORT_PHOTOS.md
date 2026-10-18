# Import des exports Lightroom / Photoshop

Vous pouvez conserver vos dossiers nommés `Chiens/Nala`, `Chats/Maya`, etc. Ils servent au regroupement visuel ; seul l’animal choisi dans Anipic détermine l’album destinataire.

1. Exporter depuis Lightroom/Photoshop en JPEG, PNG, WebP ou AVIF statique. Les RAW, PSD et catalogues ne sont pas des formats d’import.
2. Ouvrir **Photos à trier**, puis déposer des fichiers/dossiers ou utiliser **Importer un dossier**. Les sous-dossiers sont conservés. Le dépôt est privé à l’équipe.
3. Sélectionner une photo, plusieurs photos (Majuscule pour une plage), ou toute la page. Le filtre par dossier et la recherche aident à réunir une série.
4. Cliquer **Attribuer à un animal**. Rechercher par nom ou identifiant SPA, filtrer chien/chat/NAC, puis vérifier portrait, espèce et ID. Les homonymes restent distincts.
5. Valider. **Garder les photos privées après attribution** est coché par défaut. La visibilité pourra aussi être changée depuis la fiche de l’animal.

L’attribution est une transaction : une sélection périmée n’est pas classée à moitié. Les photos déjà présentes dans cet album ne sont pas ajoutées en double et leur visibilité n’est pas modifiée. Le classement réutilise les fichiers stockés ; aucune seconde copie physique n’est créée pendant l’attribution. Les photos à trier/écartées sont incluses dans les sauvegardes.

**Écarter** conserve une photo dans la vue **Photos écartées**, d’où elle peut être restaurée. Cette action ne supprime pas l’original. Le dépôt se fait fichier après fichier, avec progression ; après une interruption, reprendre le même dossier ne duplique pas les photos encore à trier. Limites : 500 images par dépôt, 60 par page de sélection, limite par fichier définie par `MAX_UPLOAD_MB` (25 Mo par défaut).

## Dossier de dépôt sur le NAS, facultatif

Le navigateur fonctionne sans NAS configuré. Pour exporter directement vers un dossier de votre stockage :

```dotenv
ANIPIC_IMPORT_PATH=/mnt/nas/exports-anipic
```

```sh
docker compose -f compose.yml -f compose.import.yml up -d
```

Le dossier est monté **en lecture seule** sur `/imports`. Dans Anipic, **Lire le dossier de dépôt** importe jusqu’à 100 images par lecture ; relancer s’il reste une suite. Aucun export d’origine n’est déplacé ou supprimé. Les fichiers modifiés depuis moins de dix secondes sont laissés de côté pour éviter un export encore en cours. Les liens symboliques sont ignorés, la profondeur et le nombre d’entrées sont bornés. Les fichiers inchangés déjà lus sont mémorisés, même une fois leurs photos attribuées.

Hors Docker, définir `IMPORT_DIR` sur le chemin absolu du dossier. Ce chemin n’est pas exposé aux visiteurs. La lecture se lance sur demande ; aucun service de surveillance permanente n’est activé. Le montage NAS réel reste à vérifier sur votre serveur.

La lecture crée une copie dans le stockage Anipic ; le dossier d’exports reste indépendant. La déduplication évite les copies répétées dans Anipic. Un dossier de plus de 10 000 entrées doit être traité par sous-dossiers.

## Liste de séance imprimable

**Planning photo → Liste imprimable**. Choisir les demandes de l’équipe, les animaux sans photo ou leur réunion ; filtrer par espèce, sélectionner les animaux, renseigner éventuellement date et photographe. Les portraits peuvent être masqués pour économiser l’encre.

**Imprimer / PDF** ouvre l’impression du navigateur : choisir l’imprimante ou « Enregistrer au format PDF ». La feuille A4 contient noms, espèces, IDs, priorités, demandes, notes et trois cases : **Photographié / Traité / Importé**. La navigation et les commandes ne sont pas imprimées. Une coche sur papier ne modifie pas automatiquement le planning du site.
# Corriger une attribution et trouver la bonne fiche

Dans une fiche animal, **Réattribuer cette photo** déplace le portrait affiché vers un autre animal. Pour une série, cocher les miniatures puis **Réattribuer la sélection**. Les originaux, légendes, commentaires, favoris, albums et réglages privé/public sont conservés. Le déplacement est atomique : si une photo existe déjà à destination, y compris dans la corbeille, aucune photo du lot n’est déplacée.

Après une attribution depuis **Photos à trier** ou une réattribution, utiliser **Ctrl+Z** (Cmd+Z sur Mac) ou **Annuler**. L’historique de navigation conserve 30 actions ; les attributions restent annulables pendant 30 minutes, jusqu’au rechargement de page ou au redémarrage du serveur. Une modification ultérieure ou une nouvelle utilisation d’une photo peut empêcher l’annulation pour protéger le travail de l’équipe ; la réattribution manuelle reste possible.

La case **Photos privées · comptes connectés uniquement** est décochée par défaut. La cocher masque la série aux visiteurs anonymes après attribution. Réattribuer une photo conserve son réglage actuel.

Le bloc **Ça ressemble à…** compare localement les couleurs et le contraste des photos sélectionnées avec jusqu’à deux portraits locaux par animal et sa photo de référence SPA. Les fiches parties/archivées et la fiche d’origine sont exclues. Aucun service IA externe n’est utilisé. Les arrière-plans et pelages proches peuvent produire de faux rapprochements : vérifier le portrait et l’identifiant avant de valider. La comparaison ne choisit jamais un animal à votre place.

Les résultats et leur provenance **Locale / SPA** apparaissent progressivement. Jusqu’à quatre images réparties dans un grand lot sont comparées ; éviter de mélanger les photos de plusieurs animaux dans une même attribution. Une image illisible ou une indisponibilité SPA n’empêche pas la recherche manuelle. La recherche s’arrête après environ une minute (les requêtes en cours peuvent finir ensuite) ou 2 000 fiches ; le résultat signale une comparaison partielle. Le bouton **Comparer** relance l’analyse avec les aperçus déjà en cache.
