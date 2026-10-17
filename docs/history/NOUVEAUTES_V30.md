# Anipic 3.0 — TV d’accueil, motion design et fiches SPA

## Programmer la TV

Dans **Administration → Écran du refuge**, les onglets Programme, Style et Diffusion règlent la présentation. L’aperçu utilise les changements du formulaire ; **Enregistrer** les applique au serveur. La TV recharge le programme sous une minute. **Ouvrir la TV** ouvre `/#display`, sans menu d’administration.

- Choisir chiens, chats et/ou NAC, changer leur ordre et masquer individuellement des animaux. La limite d’animaux s’applique après ces filtres.
- Définir 1 à 8 photos publiques par animal et leur durée. Ajouter une vidéo autorisée après les photos, avec une durée maximale de 3 à 60 secondes. La TV et les exports restent muets.
- Filtrer les médias par thème. Plusieurs tags correspondent à un « ou » ; les photos privées et archivées sont toujours exclues.
- Insérer le logo et les statistiques tous les N animaux ; 0 désactive un interlude. Les adoptions sont les animaux distincts dont un statut adopté daté a été observé pendant l’année choisie. Les compteurs chiens/chats/NAC concernent les animaux actuellement présents dans la base, hors adoption et absence confirmée.
- Choisir Éditorial, Liquid glass, Cinéma ou Galerie 3D ; régler fondu/glissement/approche, mouvement et intensité. Le relief 3D s’applique à Galerie 3D et à la mosaïque. Les autres styles utilisent un mouvement doux des photos.
- Sélectionner horizontal 1920 × 1080 ou vertical 1080 × 1920. Les horaires sont hebdomadaires, dans le fuseau Europe/Paris, et peuvent passer minuit. Hors horaires, la TV montre le logo et un écran de veille.

Sur la TV : espace pour mettre en pause, flèches pour changer de séquence, commande plein écran. Les commandes s’effacent automatiquement et restent accessibles au clavier. Le navigateur doit rester ouvert et avoir accès au serveur. Ce module ne télécommande pas l’allumage physique de la télévision et ne fournit pas de lecteur hors ligne.

## Vidéos sur les fiches

Sur une fiche connectée, **Vidéos de l’animal → Ajouter une vidéo** importe un MP4/WebM/MOV validé, ou **Choisir dans les médias du studio** réutilise un média déjà importé. Aucune seconde copie du fichier n’est créée. Une vidéo est privée à l’import. L’équipe peut ajouter une légende, des tags et cocher **Autoriser sur la TV publique**. Détacher retire uniquement le lien vers la fiche ; le média demeure dans le studio.

Le flux vidéo public n’est accessible que lorsque l’écran est activé, que la vidéo est autorisée et que l’animal et son média passent les filtres du programme. Les animaux masqués, réservés exclus, partis et les tags non retenus cessent d’être servis sur cette route. La révocation est vérifiée à chaque nouvelle requête, y compris les requêtes de lecture partielle. Elle ne peut rappeler une copie déjà téléchargée.

## Tags photo et vidéo

Sous les téléchargements d’une photo, ajouter un ou plusieurs thèmes séparés par une virgule : Halloween, Noël, portes ouvertes… Même commande sous chaque vidéo associée. Maximum 20 tags par média, 40 caractères par tag, sans doublons de casse. Ces annotations appartiennent aux médias et ne modifient aucune information SPA. Les tags sont accessibles à l’équipe connectée, avec un filtre **Thème des photos** dans la bibliothèque. Les filtres TV portent sur les photos et vidéos individuellement.

## Films et fonds animés

**Création → Fonds animés & réseaux** propose Fond PC animé, Mosaïque story, Portraits en story et Présentation TV. Régler le programme, le format, le style et les animaux, puis **Exporter en MP4**. Le moteur visuel est partagé avec l’écran en direct. Les horaires d’accueil ne limitent pas un film exporté.

Les exports utilisent les photos locales publiques, les vidéos autorisées sur la TV et, si cette option de diffusion est activée, les références photo SPA. Ces références sont téléchargées par le serveur depuis les hôtes SPA autorisés, limitées à 5 Mo, normalisées et prises dans le même cache régénérable que la galerie. Elles gardent leur repère SPA et ne sont jamais comptées comme des portraits locaux. Une référence indisponible interrompt le rendu avec le nom de l’animal concerné.

MP4 H.264, 24 images/s, 1080p dans l’application ; 10 minutes maximum par export et un seul rendu Remotion à la fois pour préserver le serveur. Progression, annulation, téléchargement privé et corbeille récupérable sous l’aperçu. Retirer un export ne supprime pas les fichiers sources. Les exports génèrent naturellement un fichier MP4 supplémentaire ; ils sont inclus dans les sauvegardes. Le montage vidéo habituel reste disponible dans Studio vidéo pour le son, les sous-titres et les autres opérations.

## Fiches pour les box

Sur une fiche avec photo locale : **Affiche & pack communication**. Choisir SPA institutionnel, Éditorial, Liquid glass ou Contraste, puis le papier A4/A5, le cadrage et l’affichage des ententes/QR. Export PDF aux dimensions physiques du papier ou PNG 300 dpi. Le modèle sélectionné est aussi utilisé dans le pack communication.

Le nom, le sexe, l’âge disponible, la race, le statut, la description et les ententes viennent de la fiche SPA. Le QR apparaît seulement pour un lien de fiche SPA valide. Les textes trop longs sont limités à la place disponible, sans réécrire les faits. Vérifier le cadrage et la longueur des textes avant impression. Les quatre PDF d’exemple dans `docs/examples/` utilisent un profil fictif explicitement indiqué.

## Application de la charte fournie

Référence : « Charte de la SPA — version simplifiée », 12 pages, document fourni par Gaerisson.

- Pages 2–3 : logo complet intact, zone de protection ; largeur 42 mm sur A4, environ 29,6 mm sur A5. Le logo complet reste donc au-dessus du minimum de 27 mm. Aucun faux logo simplifié n’est construit.
- Pages 5–6 : aucune rotation, déformation, recoloration, ombre ou reconstruction du logo à partir des photos. À la demande de Gaerisson, le logo est utilisé avec sa transparence originale, sans cartouche blanc ajouté. Son dessin et ses proportions restent inchangés. Les effets et la mosaïque animent les images autour du logo.
- Page 7 : roux `#eb651c`, brun `#70624f`, clair `#d4c3b3` pour les nouveaux modèles ; les préférences de couleur de l’interface restent conservées.
- Pages 8–11 : les fontes Adopte et Lampion n’ont pas été fournies. Roboto, alternative web citée par la charte, est embarquée localement sous licence OFL, sans appel à Google Fonts. Le logo conserve sa propre typographie originale.

Le fond statique et le bilan annuel conservent également le logo original transparent, sans carré ajouté. Le bilan fait apparaître les portraits autour du logo officiel, plutôt que de transformer sa silhouette.

## Installation et migration

Mêmes volumes Docker/NAS et commandes que précédemment. Node 24 minimum, `npm ci`, `npm run build`, `npm run video:build` et `npm run video:browser` pour une installation native. L’image Docker comprend déjà le navigateur Remotion et ses dépendances. La compilation vidéo doit être refaite avec cette version.

Schéma SQLite 11 : tables ajoutées pour l’association des vidéos, les tags et les exports. Les originaux, IDs animaux, comptes, projets et réglages précédents sont conservés. La production démarre vide et n’exécute aucun peuplement de démo. Les essais et les exemples ont été créés dans une base isolée.

## Ajustement visuel : logo et ententes

Le fond blanc ajouté autour du logo SPA a été retiré sur la TV, les vidéos, les fonds PC et les affiches. La transparence existante du PNG est conservée. Les ententes affichent désormais des pictogrammes chien, chat, enfants et un pictogramme adapté aux autres catégories. Sur la fiche web, une coche, une croix ou un point d’interrogation complète le texte ; les précisions de la SPA restent visibles.
