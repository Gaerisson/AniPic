# AniPic 3.18.1 — Le quotidien photo, jusque sur mobile

Cette version regroupe les nouveautés du [quotidien photo 3.18.0](RELEASE_v3.18.0.md) et corrige le dernier chevauchement trouvé lors du contrôle mobile.

- **Synchroniser**, dans la barre supérieure, lance une collecte manuelle et affiche son suivi pour l’administration.
- Photos à trier avec compteur, ouverture en grand et comparaison des suggestions côte à côte.
- Synchronisation quotidienne à heure fixe, adoption automatique après les contrôles d’absence et confirmation obligatoire des présences courtes, avec seuil réglable.
- Filtres plus visibles, distinction des photos du refuge et des références SPA, fiche allégée, planning compact et impression sans menus.
- Relecture corrigée, fonctions désactivables, alerte des inscriptions Google et purge facultative des photos écartées.
- Consultations anonymes par jour et rubrique, indépendantes du suivi détaillé consenti ; partage préparé dans WhatsApp et étude des bots.

Sur téléphone, les boutons d’espèces respectent désormais la largeur de leur texte et passent à la ligne. « Tous les compagnons » ne chevauche plus « Chiens ».

La 3.18.0 a passé les 364 tests, les builds web/vidéo, Android et un vrai rendu MP4 dans Docker. Le navigateur redevenu disponible a permis de vérifier le badge du tri, les grandes photos, la comparaison, la fiche et le planning, ainsi que le mode impression sans interface AniPic. Le correctif mobile suit les mêmes contrôles de publication. Voir [VALIDATION.md](VALIDATION.md).

Pour Portainer : `ghcr.io/gaerisson/anipic:3.18.1`, en conservant les volumes, chemins et variables existants. Version native et APK conservées en **3.14.0**. Aucun déploiement NAS ni connexion de bot WhatsApp n’est effectué par cette release.
