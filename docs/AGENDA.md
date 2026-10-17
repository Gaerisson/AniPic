# Agenda partagé

Ouvrir **Le refuge → Agenda partagé**, ou **Outils de l’équipe → Agenda partagé**.

Choisir un mois, puis **Nouvel événement**. Renseigner un titre, la date de début et de fin, éventuellement l’heure, le lieu et des précisions. Les catégories proposées sont portes ouvertes, collecte, événement, rendez-vous et à noter. Les dates sont celles du refuge, en France ; l’heure saisie est une heure locale.

Trois choix indépendants :

- **Date importante** : l’événement apparaît dans le filtre des dates clés et dans le module d’accueil.
- **Reprendre dans la gazette** : l’événement entre dans l’édition de son mois et celle du mois précédent. La gazette propose des cases pour masquer des événements dans une édition seulement.
- **Diffuser sur l’écran TV** : le titre, les dates, le lieu et les précisions deviennent publics dans le programme TV. Ce choix est désactivé par défaut. Ne pas y placer de coordonnées personnelles ou d’informations internes.

Les événements annulés ou retirés ne sont plus repris automatiquement dans la gazette et la TV. Un export déjà téléchargé conserve son contenu. Les rendez-vous sur plusieurs jours restent visibles dans les mois qu’ils traversent.

## Accueil et TV

Dans les paramètres des modules d’accueil, activer **Agenda partagé · dates importantes**. Le module présente jusqu’à six dates clés prévues dans les 90 prochains jours, aux comptes connectés. Les visiteurs voient une invitation à se connecter.

La TV reprend jusqu’à six événements prévus, autorisés à la diffusion, dans les 90 prochains jours. Une séquence de dix secondes est placée tous les quatre animaux, et les séquences restantes en fin de programme. Ces scènes figurent dans la timeline : leur position et leur durée peuvent être ajustées, ou leur affichage masqué. Pour changer leur texte ou cesser leur publication partout, modifier l’événement dans l’agenda. Le mode fond d’écran n’intègre pas ces messages.

Le lecteur TV récupère les données toutes les 60 secondes. L’agenda et la gazette s’actualisent aussi au retour dans l’onglet. Le réglage **Actualiser** permet une reprise immédiate. Une édition générée signale les changements de ses données sources avant d’autoriser à nouveau ses exports.

## Accès, conservation et conflits

Les comptes administration, photographe, agent SPA et bénévole approuvé peuvent gérer l’agenda. Les lecteurs connectés peuvent le consulter. Le PIN seul ne donne pas accès à ces routes. Les écritures exigent une session et un jeton CSRF valide.

Chaque événement possède une révision. Si un autre membre le modifie entre son ouverture et son enregistrement, la saisie est refusée avec un message explicite : fermer puis rouvrir l’événement pour reprendre la version actuelle. Les suppressions retirent l’événement des listes, tout en conservant sa ligne et la trace dans le journal. Les sauvegardes SQLite conservent l’agenda. Aucun service externe n’est requis.

## API d’équipe

Toutes les routes nécessitent une session AniPic authentifiée. Les écritures nécessitent également `X-CSRF-Token` et une origine autorisée.

| Route | Usage |
| --- | --- |
| `GET /api/agenda?from=2026-10-01&to=2026-10-31` | Événements qui traversent la période, jusqu’à 500 résultats ; `total` et `truncated` indiquent la limite. Période maximale : 370 jours. |
| `POST /api/agenda` | Création ; réponse `id`, `revision`. |
| `PUT /api/agenda/:id` | Remplacement avec les champs et la `revision` obtenue à la lecture. |
| `DELETE /api/agenda/:id` | Retrait avec un corps JSON contenant `revision`. |

Exemple de corps de création :

```json
{
  "title": "Portes ouvertes",
  "date": "2026-10-25",
  "endDate": "2026-10-25",
  "time": "14:30",
  "category": "open_day",
  "location": "Accueil du refuge",
  "description": "Une après-midi pour rencontrer les animaux.",
  "keyEvent": true,
  "shareGazette": true,
  "showOnTV": false,
  "status": "scheduled"
}
```

Les accès anonymes sont refusés, les lecteurs ne peuvent pas écrire et une révision périmée produit une erreur HTTP 409. Dates impossibles, fin précédant le début et heures invalides sont refusées.
