# AniPic 3.14.0 — Un atelier plus clair, des créations plus libres

- **Navigation simplifiée** : réglages et administration regroupés en onglets, compte séparé de l’équipe, options Android visibles sur mobile. À propos reste dans le pied de page.
- **Canvas** : éditeur visuel basé sur Fabric.js, avec modèles SPA, verre et saisons, textes, formes, photos locales ou SPA, positionnement, rotation, calques, alignement, verrouillage, annulation et export PNG/JPEG/SVG. Brouillon sur l’appareil, projets privés ou partagés avec l’équipe et détection des modifications concurrentes.
- **Rédaction & relecture** : véritable éditeur de texte, mise en forme, propositions soulignées, application ou refus des corrections dans le texte. Les textes restent des propositions : aucune fiche SPA n’est publiée automatiquement.
- **IA** : prise en charge de plusieurs formats de réponses publiques, budget adapté et nouvelle tentative bornée après une réponse vide ou tronquée. Les raisonnements internes ne sont jamais affichés.
- **Studio vidéo** : portraits SPA acceptés par la mosaïque annuelle, exclusion des archives supprimées et des couvertures vidéo inadaptées. Un total d’adoptions peut être saisi pour un montage sans changer les statistiques du refuge.
- **TV** : lecture publique sans PIN, portraits limités au programme autorisé, administration et médias privés toujours protégés. Statut de connexion et diagnostic discrets configurables, mouvements photo plus doux et respect des préférences de mouvement réduit.
- **Suivi** : journal filtrable, progression des opérations, heure de Paris et diagnostic de l’horloge serveur. Alerte visible pour les demandes bénévoles en attente.
- **Archives** : après vidage explicite et sauvegarde vérifiée, la fiche et son historique sont réellement retirés. Une empreinte technique empêche sa réimportation ; les totaux annuels anonymes sont conservés. Les originaux encore utilisés par un projet sont signalés comme protégés.
- **Prise en main** : visite guidée centrée sur les fiches, ententes, portraits, nouvelles et présences. Les sondages WhatsApp sont retirés du menu ; les anciennes données ne sont pas effacées.

## Mise à jour

Conserver la stack, SQLite, les volumes, les montages NAS et les configurations existants. La migration 24 ajoute les projets Canvas et les registres techniques de suppression ; elle n’efface aucune archive automatiquement.

Le détourage précis demande toujours une marge mémoire suffisante. Dans les variables **de la stack Portainer**, définir `ANIPIC_MEMORY_LIMIT=4g`, puis mettre à jour la stack existante. La VM doit disposer de cette mémoire et d’une marge pour le système et les autres conteneurs. Les essais de modèles plus économes n’ont pas donné une qualité suffisante pour les remplacer automatiquement.

L’APK utilise le même certificat de signature. Les changements web arrivent avec la mise à jour du serveur. Android conserve sa confirmation système pour installer une nouvelle APK.

Les validations et leurs limites sont consignées dans [VALIDATION.md](VALIDATION.md). Le fonctionnement sur le NAS, la TV et un téléphone physiques ne peut pas être déduit des seuls tests automatisés.
