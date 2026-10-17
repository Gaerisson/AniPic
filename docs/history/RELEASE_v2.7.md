# Anipic 2.7 · Photos, priorités et planification

Cette version facilite la consultation des photos et la préparation des portraits manquants. Les cartes disposent de flèches, les références SPA restent en couleur et le badge À photographier coexiste avec SOS.

- Glassmorphism activable dans Configuration, réglages communs côté serveur, flou et opacité ajustables.
- Priorités photo configurables : SOS urgent et réservés en fin de liste par défaut. Classement avant pagination, demandes préremplies et feuille imprimable.
- Planification serveur manuelle, par intervalle ou cron, fuseau horaire, presets et aperçu des échéances.
- Fil du refuge regroupé par date avec portraits et filtres serveur.
- Finitions du thème sombre : badges, imports, notifications, graphique et jauges du stockage ; cartes du planning alignées.
- Suppression des panneaux de checklist générique, contrôle des images, estimation du stockage et du bandeau sur les absences.

Les données SPA, les originaux et les demandes existantes sont conservés. Les protections d’archivage restent actives. Les données de démonstration utilisent un stockage distinct exclu de Docker ; la production ne lance aucun peuplement automatique.

Validation : **83 tests automatisés réussis**, compilation de production et contrôles dans le navigateur. Le déclenchement du planificateur a été testé avec une horloge simulée ; aucun test n’a lancé une collecte réelle ou modifié les fiches de la démo. [Guide d’utilisation](NOUVEAUTES_V27.md) · [Vérifications détaillées](../../VALIDATION.md).

Conception et photographie : [Gaerisson](https://github.com/Gaerisson/). Développement assisté par **OpenAI Codex**.
