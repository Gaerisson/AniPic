# Registre interne et grandes affiches

## Registre de vigilance

Ouvrir **Le refuge → Registre interne** avec un compte administration ou agent. Les comptes photographe/lecteur et les visiteurs n’y accèdent pas. Une entrée contient un nom, un contact ou une référence facultatifs, les faits observés, les consignes et une date de révision facultative. Un retrait reste restaurable depuis **Entrées retirées**. Si deux personnes éditent la même entrée, la seconde doit actualiser avant de remplacer la nouvelle version.

Les données restent dans SQLite et ses sauvegardes ; elles ne sont jamais ajoutées au contexte envoyé à l’IA, au fil public ni aux exports des animaux. Le journal des actions ne conserve que des identifiants et des nombres. Aucun envoi de message ou décision automatique ne dépend du registre.

### Import Excel

Enregistrer un classeur `.xlsx` avec ces colonnes dans la première feuille, ou un CSV UTF-8 séparé par des points-virgules ou virgules :

| Nom | Prénom | Contact | Motif | Consignes | Révision |
| --- | --- | --- | --- | --- | --- |
| Exemple fictif | Camille | Référence interne | Observation datée | Contacter le responsable | 31/12/2026 |

Seul **Nom** est obligatoire ; le prénom est concaténé au nom. Contact accepte un texte libre (téléphone, courriel ou référence). Révision accepte JJ/MM/AAAA, AAAA-MM-JJ et les dates numériques Excel. Les anciens `.xls` doivent être réenregistrés en `.xlsx` ; les classeurs chiffrés ne sont pas pris en charge. Les cellules avec formule sont ignorées, y compris leur valeur calculée.

Limites : 8 Mo, 1 000 lignes, 40 premières colonnes, 16 Mo cumulés de contenu décompressé. Les entités XML et les feuilles externes sont refusées ; aucune macro n’est exécutée. L’aperçu n’écrit pas dans le registre. Choisir ensuite les lignes et cliquer **Ajouter**. Les doublons exacts nom/contact sont ignorés, les autres entrées sont ajoutées sans écrasement. Le fichier original n’est pas conservé dans AniPic.

### Routes internes

Toutes exigent une session administration/agent ; les écritures exigent aussi CSRF et origine autorisée.

- `GET /api/internal-register?q=&page=1&deleted=0` : 50 entrées par page.
- `POST /api/internal-register` : ajout.
- `PATCH /api/internal-register/:id` : édition/retrait/restauration, avec l’en-tête `X-Anipic-Version` égal à `updated_at`.
- `POST /api/internal-register/import-preview` : fichier multipart `.xlsx`/CSV.
- `POST /api/internal-register/import` : `{ rows: [...] }` après aperçu.

## Grande affiche du refuge

Ouvrir **Création → Grande affiche du refuge**. Filtrer les animaux par espèce ou nom, sélectionner jusqu’à 60 portraits, puis choisir un modèle :

- **Mosaïque SPA** : fond clair, orange et bords de photos découpés.
- **Verre moderne** : dégradés lumineux, cartes translucides et reflets.
- **Éditorial** : fond sombre et grille nette.
- **Instants du refuge** : papier chaud et polaroids légèrement inclinés.

Les noms, textes, accent, format, colonnes et QR code sont personnalisables. Le nombre de colonnes augmente si nécessaire pour éviter plus de dix rangées. La dernière rangée est centrée. L’option locale utilise la couverture publique ou le portrait public local le plus récent ; la source SPA reste sélectionnable lorsqu’elle existe. Un animal n’ayant que des photos privées et aucune référence SPA n’est pas proposé. Les originaux ne sont ni modifiés ni copiés dans un nouvel album.

Cliquer **Créer l’aperçu** avant de contrôler la composition. Le chargement attend toutes les photos. Une erreur nomme l’animal dont la source est indisponible. Après modification, le panneau indique que l’aperçu est à actualiser ; l’export utilise toujours les réglages actuels.

PNG/PDF portrait A4 (2480 × 3508 px), A3 (3508 × 4962 px environ) et A2 (4960 × 7016 px), avec dimensions physiques PDF correspondantes. Les documents sont rasterisés à environ 300 dpi ; une petite photo d’origine ne devient pas plus détaillée lors de l’agrandissement. Les reflets imprimés sont dessinés dans l’image, sans dépendre des effets CSS du navigateur.

`POST /api/group-posters` est réservé à administration/photographe/agent ; les aperçus et fichiers générés ne sont pas publiés dans une URL publique. Une génération à la fois par instance ; 60 animaux maximum. L’export peut prendre davantage de temps pour 60 références SPA ou le format A2.

## Affiches de box et feuille de séance

**Affiches de box en série** : **Sélectionner tous les résultats** sélectionne tous les résultats du filtre, et non seulement les vingt premiers. Les filtres n’effacent pas la sélection. Le téléchargement produit des PDF successifs de vingt pages ; autoriser les téléchargements multiples si le navigateur le demande. Une erreur laisse les lots précédents déjà téléchargés disponibles.

**Feuille de séance** : portraits agrandis et espace de notes. Le mode demandes suit le planning ; retirer une demande ne supprime pas l’animal, qui peut rester proposé dans **Sans photo locale**. Ctrl+Z annule le retrait tant qu’aucune autre modification concurrente n’a remplacé sa version.
