# AniPic 3.5 — Regards du refuge

## Grandes affiches

Une nouvelle page **Création → Grande affiche du refuge** compose jusqu’à 60 portraits, avec quatre modèles : mosaïque SPA aux bords découpés, verre moderne, éditorial et polaroids. Choix des animaux, source locale ou SPA, noms facultatifs, titre, sous-titre, pied de page, accent, colonnes et QR code. Les exports PNG et PDF sont aux dimensions A4/A3/A2, à environ 300 dpi pour le document. La netteté de chaque portrait dépend de sa photo d’origine. Le logo SPA transparent conserve ses proportions. Une photo indisponible bloque la génération avec le nom de l’animal concerné, sans exporter de cadre vide. Les photos privées sont exclues de cette composition.

Les affichettes de box en série permettent désormais de sélectionner tous les résultats et de conserver la sélection à travers les filtres. Le téléchargement reste borné à 20 pages par PDF ; une sélection plus grande produit plusieurs PDF successifs. Le navigateur peut demander l’autorisation de télécharger plusieurs fichiers.

## Interface et préparation des séances

- Thème **Lumière** corrigé, nouveau **SPA · clair & verre**, surfaces et textes adaptés aux fonds clairs. Le verre suit le réglage de l’administration.
- Choix du thème propre au navigateur, validation de la valeur et synchronisation entre onglets. Le réglage serveur sert de défaut tant qu’aucun choix n’est enregistré sur ce navigateur.
- Un seul bouton assistant ; recherche et conversation restent disponibles dans le panneau.
- Barre supérieure, menus, formulaires, carrousel, filtres, fiches, affichettes et nouveaux écrans adaptés aux petits écrans.
- Génération de prénoms avec univers nature, cosmos, gourmandise, cinéma, voyages, Halloween, Noël et musique, combinés au sexe et à la première lettre. Les noms présents au refuge restent exclus.
- Filtres SOS, ententes chats, chiens et enfants sur l’accueil/la liste principale, combinables avec les filtres existants et appliqués avant la pagination.
- Réponses d’entente qualifiées en orange, sans perdre le texte original ; oui/non simples restent verts/rouges. Aucune qualification n’est assimilée à un oui sans réserve.
- Valeurs de type `N/A` omises dans les informations des fiches et exports ; sexe/âge inconnus ne produisent plus de ligne vide à renseigner.
- Contrôle privé/public plus visible sur la photo d’un animal. Les droits déjà en place sont conservés : privé signifie visible à l’équipe connectée, absent de la consultation publique et de la TV.
- Demande photo retirable depuis le planning, avec annulation Ctrl+Z. La suppression est réversible et retire la demande des compteurs, du planning et de la feuille de séance.
- Portraits plus grands dans la feuille de séance, notes et cases plus lisibles, y compris à l’impression.

## Registre interne

**Le refuge → Registre interne**, réservé aux comptes **administration et agent**. Nom, contact/référence, faits observés, consignes et date de révision. Recherche, édition avec contrôle de version, retrait et restauration. Import Excel `.xlsx` ou CSV UTF-8 avec aperçu et sélection des lignes avant ajout, sans écraser les entrées existantes. Les doublons exacts nom/contact sont ignorés.

Le registre reste exclu du contexte IA, des API publiques et des fiches d’animaux. Le journal général conserve l’identifiant et le type d’action, sans recopier les noms, contacts ou observations. La base SQLite sauvegardée comprend le registre. [Format d’import et utilisation](../REGISTRE_AFFICHES.md).

Migration SQLite **16 → 17**, additive : tables du registre et des demandes retirées. Aucun changement de montage ni de volume Docker. Les protections NAS restent actives.

## Reporté avec accord

L’extension Edge pour SPA/Argos reste de côté : l’adresse d’Argos et les champs à remplir seront fournis ultérieurement.

## Vérification

[Validation réellement effectuée et limites](../../VALIDATION.md). La construction et l’exécution de l’image Docker et un déploiement Portainer/NAS réels exigent un moteur Docker ; ne pas les déduire d’un build frontend ou d’une validation Compose.
