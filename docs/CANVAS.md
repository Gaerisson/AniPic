# Le Canvas AniPic

Ouvrir **Créer → Atelier Canvas**. Choisir un format et un modèle, puis ajouter les animaux ou importer une image PNG, JPEG ou WebP. La bibliothèque indique si le portrait vient de l’équipe ou du site SPA. Le téléchargement et le détourage doivent aboutir avant de remplacer l’image dans le visuel ; une erreur reste visible.

Sélectionner un élément pour changer sa couleur, sa taille, son angle, sa transparence ou son placement. Un double clic permet d’écrire directement dans le texte. Les calques sont listés du premier plan à l’arrière-plan et peuvent être verrouillés. Les boutons Avancer/Reculer changent leur ordre. Ctrl/⌘ Z annule, Maj Ctrl/⌘ Z rétablit ; Suppr retire la sélection. L’atelier peut être agrandi pour occuper toute la fenêtre.

Le brouillon est sauvegardé dans IndexedDB sur cet appareil, séparément pour chaque compte. Un navigateur privé, un quota de stockage ou l’effacement des données du navigateur peut le faire perdre : utiliser **Enregistrer** ou exporter le projet JSON pour une conservation durable. Les visiteurs peuvent composer et exporter localement ; la sauvegarde sur le serveur nécessite un compte créateur autorisé.

Les projets enregistrés sont privés par défaut. **Partager avec l’équipe** permet aux comptes de l’équipe de les lire, et aux créateurs de les modifier. Le propriétaire ou l’administrateur contrôle le partage et la suppression. Si le projet change sur un autre appareil, AniPic refuse d’écraser sa version et propose de rouvrir le projet ou d’enregistrer une copie.

Les exports PNG conservent un fond transparent lorsqu’il est choisi. JPEG convient aux photos, SVG aux visuels réutilisables, JSON aux projets modifiables dans AniPic. Les dimensions d’export correspondent au format, indépendamment du zoom de l’éditeur. Les imports JSON n’acceptent pas les URL externes, SVG arbitraires ou éléments exécutables. Limites : 250 éléments, 16 mégapixels et environ 10 Mo de document.

L’éditeur utilise [Fabric.js](https://github.com/fabricjs/fabric.js), sous licence MIT ; ses notices et celles de Tiptap sont incluses dans `THIRD_PARTY_NOTICES.txt`.
