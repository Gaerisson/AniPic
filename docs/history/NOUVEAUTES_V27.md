# Anipic 2.7 — utilisation

## Cartes photo

Les flèches apparaissent lorsque plusieurs photos locales sont disponibles. Elles parcourent jusqu’à six aperçus par animal sans ouvrir sa fiche. Le compteur suit l’image affichée. Les commandes fonctionnent au clavier et au toucher ; un clic manuel suspend le défilement jusqu’au prochain survol. La fiche donne accès à l’album complet.

**Configuration → Cartes et lecture → Défilement des photos au survol** active l’alternance automatique, avec intervalle réglable. La réduction des mouvements et le réglage d’animations du visiteur restent respectés.

Les photos du site SPA restent en couleur. Le cadre pointillé et le badge bleu **Source SPA** les distinguent des originaux locaux. Elles ne comptent pas comme une photo locale. Les badges **SOS adoption** et **À photographier** restent visibles ensemble.

## Apparence

**Configuration → Apparence → Glassmorphism · verre dépoli** active l’effet pour tout le site, après enregistrement. Le flou et l’opacité sont réglables. Il s’applique aux trois thèmes ; les grilles de photos utilisent des surfaces translucides sans multiplier les filtres de flou. Une préférence système de transparence réduite rétablit les surfaces opaques.

Contrastes et fonds corrigés pour les badges, les dépôts de fichiers, les notifications et le stockage. Cartes du planning mieux alignées et suggestions avec portraits. Suppression des blocs Préparer une séance, Contrôle des images, Estimation du stockage et du bandeau explicatif sur les absences. Le planning et la feuille imprimable restent disponibles.

## Règles photo

**Configuration → Priorités des photos** contient trois règles, enregistrées côté serveur :

| Animal  | Priorité initiale |
| ------- | ----------------- |
| SOS     | Urgente           |
| Autre   | Normale           |
| Réservé | Basse             |

SOS est évalué avant la réservation. Ces priorités ordonnent les animaux actifs sans photo locale avant la pagination du planning, préremplissent les nouvelles demandes et classent la liste imprimable. Une demande explicitement enregistrée par l’équipe garde sa priorité. Les informations et statuts SPA ne sont pas modifiés.

## Synchronisation automatique

**API & connexions → Synchronisation automatique**, puis **Enregistrer les connexions**. La source doit également être configurée et active.

- **Manuelle** : bouton Synchroniser maintenant uniquement.
- **Intervalle** : de 1 à 168 heures, à compter du dernier démarrage enregistré.
- **Calendrier cron** : cinq champs numériques minute, heure, jour du mois, mois, jour de semaine. `*`, listes, plages et pas sont acceptés. 0 et 7 désignent dimanche. Le fuseau initial est Europe/Paris.

Exemples : `0 8,14,20 * * *` pour 8 h, 14 h et 20 h ; `0 */6 * * *` toutes les six heures ; `0 9 * * 1-5` à 9 h du lundi au vendredi. Les combinaisons de jour du mois et de semaine suivent les règles cron usuelles : si les deux sont restreints, l’un des deux suffit.

L’aperçu recherche jusqu’à trois échéances dans les huit prochains jours ; un calendrier plus rare peut n’en afficher aucune. Le serveur vérifie chaque minute et ne lance pas deux synchronisations dans la même minute UTC, ni deux synchronisations en parallèle. Une heure locale répétée lors du passage à l’heure d’hiver possède deux occurrences ; une heure inexistante au printemps n’est pas exécutée. Aucun rattrapage des créneaux manqués lorsque le serveur était arrêté. L’aperçu local `npm run preview` désactive le planificateur ; le serveur de production l’active. Ce calendrier appelle le connecteur Anipic et n’exécute aucune commande système.

Le retrait du bandeau sur les absences concerne l’interface. Les protections des inventaires partiels, vides ou incohérents et de l’archivage restent actives.

## Fil du refuge

Portraits, dates et repères pour chaque événement, filtres **Arrivées / Adoptions / Retours / Archives**. Les filtres sont appliqués côté serveur avant pagination. Le filtre Adoption dépend d’un statut adopté explicitement enregistré ; une absence de source ne devient pas une adoption. RSS et API sont conservés.

## Production et démo

`npm run preview` peuple uniquement son stockage séparé `.demo`. Ce dossier n’entre ni dans l’image Docker ni dans l’archive distribuée. Le démarrage de production ne peuple pas la base et Compose utilise `DEMO_MODE=false`. Des volumes neufs sont vides ; une base de production existante garde ses propres données. Ne montez pas le dossier de démonstration comme volume de production.

Références techniques : [backdrop-filter Tailwind CSS](https://tailwindcss.com/docs/backdrop-filter-blur), [format crontab](https://www.man7.org/linux/man-pages/man5/crontab.5.html).
