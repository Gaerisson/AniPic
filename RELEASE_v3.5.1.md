# AniPic 3.5.1

Les fenêtres des deux thèmes clairs restent blanches et lisibles, même lorsque le verre est réglé à 35 %. Le voile sombre ne traverse plus les modals d’animaux, d’albums, de téléchargement ou de formulaire. Les surfaces de lecture et l’assistant sont protégés ; les cartes de page gardent leur effet de verre. Les anciennes couleurs vertes des textes secondaires suivent désormais le thème.

Le générateur de prénoms exclut les noms des animaux encore présents au refuge (réservés compris) et ceux actuellement publiés sur le site national SPA. Accents, espaces, casse et ponctuation ne permettent plus de proposer un doublon. Les identifiants ajoutés au titre et les mentions entre parenthèses sont écartés de la comparaison ; les composantes d’un nom composé sont aussi exclues par précaution. Les noms des animaux archivés, adoptés ou renommés peuvent être réutilisés, sauf s’ils sont encore employés par un autre animal présent ou publié sur la SPA.

Le catalogue national est séparé des fiches du refuge : aucune importation d’animaux, aucun archivage. Un relevé réel du 17 octobre 2026 couvre **4 457 fiches**, soit **3 865 noms distincts**, sur **248 pages**. Il est daté et valable 24 h. **Outils de l’équipe → Actualiser le catalogue SPA** relit le catalogue avec une progression visible, conserve uniquement un relevé complet et laisse le travail continuer en quittant la page. La première lecture prend quelques minutes. Si le catalogue est périmé et la SPA indisponible, les propositions restent suspendues avec une erreur explicite. La vérification couvre les noms des fiches publiques, pas les animaux jamais publiés sur le site SPA.

**Archives** est désormais l’unique entrée pour les animaux partis et leurs albums. Les dossiers par espèce et année, la corbeille et la création du bilan annuel restent accessibles. Les anciens liens `#departures` ouvrent les Archives. Aucun dossier ni original n’est supprimé.

Aucune nouvelle dépendance ni migration SQLite. Les montages Compose et les volumes persistants sont conservés. Voir [les vérifications réellement effectuées](VALIDATION.md) et [l’installation Docker / Portainer](docs/DEPLOIEMENT.md).
