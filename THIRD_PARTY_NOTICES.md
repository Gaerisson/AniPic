# Notices des composants tiers

La GPLv3 d’AniPic porte sur son code original. Les composants tiers gardent
leurs auteurs, leurs notices et leurs licences. Les versions effectivement
utilisées sont consignées dans `package-lock.json` et les fichiers Gradle.

## Studio vidéo — Remotion

Les paquets `remotion`, `@remotion/player`, `@remotion/bundler`,
`@remotion/renderer` et leurs composants Remotion sont utilisés en version
**4.0.535**. Ils relèvent de la **Remotion License**, qui possède des conditions
d’éligibilité et n’est pas la GPL. Le texte fourni avec cette version est
conservé dans [licenses/Remotion-4.0.535.md](licenses/Remotion-4.0.535.md).

L’exception de liaison dans [LICENSE.md](LICENSE.md) permet la combinaison du
code AniPic avec ces bibliothèques ; elle n’accorde aucun droit supplémentaire
sur Remotion. Vérifier les conditions applicables à votre structure avant une
redistribution ou un usage commercial : [licence officielle Remotion](https://www.remotion.dev/docs/license).
Une licence d’entreprise peut être nécessaire selon ces conditions.

## Autres composants

- React, Fastify, Tailwind CSS, Lucide, Sharp, PDF-lib, QRCode,
  html-to-image et les autres paquets npm : notices et licences de leurs
  distributions, conservées par `npm ci`. La nomenclature complète figure
  dans le lockfile ; la liste de crédits du README ne la remplace pas.
- `web-push` : Mozilla Public License 2.0, notices présentes dans sa
  distribution npm. Ce composant n’est pas modifié dans AniPic.
- Détourage optionnel BiRefNet et inférence Transformers.js / ONNX Runtime :
  notices spécifiques conservées dans [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
- Sources du template Android et Android Browser Helper : Apache 2.0,
  notices existantes dans [android/NOTICE](android/NOTICE) et
  [android/LICENSE-APACHE-2.0.txt](android/LICENSE-APACHE-2.0.txt).
- Polices : fichiers de licence conservés à côté des ressources dans le
  projet. DB-IP City Lite : CC BY 4.0, attribution dans le README et l’outil.
- Images de démonstration : sources et conditions indiquées dans [demo](demo).
  Les logos SPA, photos importées, musiques et autres médias gardent leurs
  droits propres et ne sont pas placés sous GPLv3 par cette livraison.

Conserver les notices fournies avec les dépendances et les médias lors de la
création d’un paquet binaire ou d’une image Docker. Ne pas présenter la licence
d’AniPic comme une autorisation de réutiliser les marques ou les photos SPA.
