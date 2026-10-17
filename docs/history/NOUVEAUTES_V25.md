# Anipic 2.5 — connecteur SPA, retouche et assistant

## Connecteur SPA vérifié

L’accès fonctionnait depuis ce PC. L’arrêt provenait du contrôle `robots.txt` d’Anipic, avant la requête JSON. Le fichier du site exclut `/app/wp-json/*` ; il ne constitue pas un refus HTTP pour le navigateur.

**API & connexions → Préparer le refuge de Morée** prépare maintenant le mode **API publique SPA · lecture directe**. Ce mode est explicite et limité à l’endpoint HTTPS exact `https://www.la-spa.fr/app/wp-json/spa/v1/animals/search/`. Les autres routes gardent leur contrôle robots. Le mode strict reste disponible. Les limites de débit, pages, délais, taille, adresses publiques et établissement s’appliquent dans les deux modes.

Cliquer sur **Tester ces réglages**, consulter le rapport, puis **Enregistrer les connexions**. Le test n’importe aucune fiche ; la synchronisation est une action distincte. La planification reste désactivée dans la démo.

Le 15 octobre 2026 à 19:50, heure de Paris, un test réel a reçu **65 animaux sur trois passages identiques**, total annoncé 65, 16 requêtes source en 46,6 s. Les espèces sans résultat acceptent la pagination `nb_pages: 0` uniquement lorsque le résultat et le total sont vides. Un échec ou une liste instable empêche toujours de confirmer un inventaire complet. Ce contrôle prouve le fonctionnement à cet instant, sans garantir la disponibilité future de cette API.

Le schéma actuel est reconnu : ID, nom, description, liens, race, sexe, âge textuel et photo de référence. « Oui mais ne pourra pas vivre avec » reste affiché intégralement ; il n’est plus réduit à « OK ». Une naissance n’est jamais calculée à partir d’un âge approximatif.

## Photos de référence SPA

En l’absence de photo locale visible, les cartes, listes et fiches montrent la photo de la SPA **en gris**, avec **Photo SPA · aucune photo locale**. La référence ne compte pas comme une photographie du photographe. Le filtre et le planning « Sans photo locale » continuent à fonctionner.

Les images passent par un proxy dédié : domaine et chemin SPA limités, pas d’URL arbitraire fournie par le visiteur, maximum 5 Mo / 40 mégapixels, aperçus WebP sans métadonnées, trois transformations simultanées. Le cache de six heures partage le budget existant des aperçus et peut être régénéré ; aucune photo locale ni copie d’original n’est créée.

## Éditeur photo

Ouvrir **Éditeur photo** ou **Retoucher cette photo** sur une fiche. Une image extérieure à la photothèque peut également être ouverte.

- Exposition, contraste, ombres, hautes lumières, saturation et température.
- Histogramme, comparaison avant/après, annuler/rétablir, rotation par 90° et miroir.
- Cadre déplaçable, coins et tracé libre ; ratios carré, portrait 4:5, Story 9:16 et paysage.
- Export JPEG, PNG ou WebP, qualité réglable, aux dimensions du recadrage de l’image originale.
- **Enregistrer dans Photos à trier** crée un import privé non attribué. Le téléchargement simple ne l’ajoute pas au serveur.

Le traitement d’une image ouverte se fait dans le navigateur, dans un worker avec aperçu réduit. La photo de bibliothèque est téléchargée avec les droits du compte. JPEG, PNG, WebP et AVIF : 30 Mo, 40 mégapixels et 12 000 px par axe maximum. L’export retire les métadonnées EXIF ; les originaux de bibliothèque restent intacts. Ce module n’est pas un développeur RAW et n’inclut pas de calques PSD, de masques ou de retouche générative. Les réglages non exportés ne constituent pas un projet persistant.

## Assistant et À propos

Le bouton **Assistant**, en bas à droite, et **Ctrl/⌘ K** cherchent des pages, outils et animaux. Les homonymes sont distingués par espèce et ID. La navigation et la recherche fonctionnent sans clé IA ; les résultats respectent les droits du compte. L’assistant ne modifie pas les fiches et n’exécute aucune action générée par un modèle.

Un compte agent/photographe/admin disposant d’un connecteur peut demander une réponse à Gemini ou Token Harbor par un clic explicite. Le serveur transmet la question et au plus cinq fiches publiques trouvées ; il ne transmet ni les clés, ni les notes internes, ni les originaux. Le texte des fiches est traité comme des données. Vérifier les réponses avant de les réutiliser.

**À propos** est accessible depuis le copyright. Le lien par défaut est [GitHub · Gaerisson](https://github.com/Gaerisson/), modifiable dans Configuration. Les services utilisés sont indiqués sur cette page.

## Voix off Mistral

Dans **Studio vidéo → Voix off**, préparer un brouillon depuis les animaux des photos du montage, ou écrire librement. Gemini/Token Harbor peuvent rédiger le brouillon si configurés. La lecture sur cet appareil est un aperçu du navigateur ; elle n’est pas ajoutée à l’export.

Pour une vraie piste audio exportable, renseigner côté serveur :

```dotenv
MISTRAL_API_KEY=
MISTRAL_TTS_MODEL=voxtral-mini-tts-2603
MISTRAL_TTS_VOICE_ID=
```

Les trois variables sont transmises par `compose.yml` et `portainer-stack.yml`. Redémarrer l’instance après modification. Ne jamais placer une clé dans le code client ni la partager dans le chat. L’identifiant de voix par défaut est facultatif : **Voix françaises Mistral** charge les voix prédéfinies françaises, puis sélectionner une voix.

**Générer la voix avec Mistral** transmet le texte au service via votre compte API. Maximum 2 000 caractères / 300 mots et six demandes par heure et par IP. Aucun clonage de voix, aucun nouvel essai automatique après une interruption réseau. Une génération déjà présente pour le même utilisateur, texte, voix et modèle est réutilisée.

Écouter le résultat puis **Ajouter au montage**. La voix possède son volume et son décalage, distincts de la musique. La musique baisse pendant la narration ; la voix ne boucle pas. Si elle dépasse la vidéo, un avertissement et **Adapter la durée des photos** permettent d’allonger les plans fixes, dans la limite de 12 secondes par photo et dix minutes de montage. Les clips vidéo ne sont pas étirés. Si le texte reste trop long, le réduire ou ajouter des photos.

Intégration basée sur la [documentation officielle Mistral TTS](https://docs.mistral.ai/studio/audio/text_to_speech/speech) et le [catalogue des voix](https://docs.mistral.ai/api/endpoint/audio/voices). L’API a été testée avec un transport simulé ; aucune clé réelle, facturation ou qualité de voix n’a été testée. Le mixage Remotion a en revanche été exporté réellement avec deux pistes audio synthétiques de test.

## Interface et idées IA

Les encarts promotionnels de stockage/sauvegarde ont été retirés au profit des mesures et actions utiles. L’horloge de Morée associe cadran et heure numérique ; la météo montre les prochains jours, les probabilités de pluie et le prochain créneau diurne favorable, sans fusionner des plages séparées. L’indication météo reste une aide indicative.

Déjà intégrés : textes Facebook, brouillons de narration, assistant de recherche/guidage et synthèse vocale. Pour la suite, les pistes les plus utiles seraient des suggestions de légendes/accessibilité, un contrôle technique des photos floues ou mal exposées et une proposition de couverture à valider. Ces trois pistes ne sont pas encore implémentées ; elles ne doivent jamais inventer la santé, le caractère ou les ententes d’un animal.

## Validation et déploiement

71 tests automatisés réussis, compilations Vite et Remotion réussies. Retouche JPEG réellement téléchargée et relue : 1 200 × 1 500 px, sans EXIF ; copie privée déposée dans Photos à trier. Parcours assistant/homonymes, référence SPA, voix off sans clé et GitHub vérifiés dans le navigateur. Éditeur et assistant contrôlés à 390 × 844 sans débordement horizontal. Voir [VALIDATION.md](../../VALIDATION.md).

La démo conserve ses profils fictifs, photos, comptes et projets. Le test réseau SPA n’a pas remplacé ses animaux. Docker/Portainer, les montages NAS et les comptes Canva/Mistral/LLM réels restent à vérifier sur l’installation cible.
