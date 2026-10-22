# AniPic 3.16.0 — Studio vidéo et narration synchronisée

- **Une timeline à pistes** : images, voix, musique et sous-titres visibles ensemble. Sélectionnez un plan pour le prévisualiser, zoomez ou affichez tout le montage, puis réorganisez les plans par glisser-déposer, avec les flèches ou au clavier.
- **Un atelier plus simple** : les onglets Le plan, Ambiance et Voix & son regroupent les réglages. Ajoutez un album complet, dupliquez un plan, ajustez son cadrage ou sa légende et retrouvez votre montage après enregistrement.
- **La vidéo suit la voix** : une piste TTS ajoutée ou un fichier voix importé active le calage automatique. Introduction, conclusion et visuels s’adaptent à la durée audio réellement mesurée, décalage compris, avec une précision d’une image. Les reprises et les plans qui ne tiennent pas dans une voix très courte sont signalés. Les sources et les extraits vidéo restent conservés à leur vitesse normale.
- **Des images plus vivantes** : zooms et panoramiques variés, textes révélés progressivement, glissements alternés et fond flouté derrière les photos affichées en entier. La musique baisse progressivement pendant la narration et se termine avec le film.
- **Des exports cohérents** : aperçu et MP4 partagent le même calcul de durée. Le mode libre reste disponible et signale une voix trop longue ; les sous-titres sont revérifiés sur la durée finale. Le montage reste limité à dix minutes.

Le [guide du studio](docs/STUDIO_VIDEO.md) détaille le montage et la voix off. L’écoute du texte sur l’appareil reste un aperçu ; une piste audio doit être ajoutée pour l’export.

Cette mise à jour concerne le web et le serveur. L’APK native reste en **3.14.0** avec sa signature existante. Mettre à jour la stack habituelle en conservant ses volumes, ses chemins NAS et ses variables. La validation locale comprend 57 tests ciblés, les builds et deux MP4 réels avec une voix française ; la publication attend également la suite complète, Android et les contrôles Docker sur GitHub Actions. Voir [VALIDATION.md](VALIDATION.md).
