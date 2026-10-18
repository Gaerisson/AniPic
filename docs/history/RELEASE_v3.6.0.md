# AniPic 3.6.0 — Bénévoles et exports en série

Inscription avec Google, puis validation explicite de chaque compte par l’administrateur dans **Équipe & accès**. Les comptes en attente ou refusés n’obtiennent aucune session. Nouveau rôle **Bénévole** : création photo/vidéo/affiches et visuels, vidéo depuis une fiche animal avec photo locale ou SPA, albums privés de l’équipe, archives, statistiques et C8. Les paramètres, le stockage NAS, les comptes, le registre interne et la configuration TV restent protégés. Retoucher une photo crée une copie sans remplacer l’original.

Le connecteur se configure dans l’interface ou par variables d’environnement. L’identité est vérifiée par la bibliothèque officielle Google ; state lié au navigateur, PKCE, nonce, signature, audience, émetteur et expiration contrôlés. Les comptes existants ne sont jamais liés automatiquement par e-mail. Le PIN reste actif sur les autres routes. Vos identifiants OAuth et une configuration Google Cloud sont nécessaires : [guide Google](../../GOOGLE.md).

Les **affiches de box en série** utilisent une tâche en arrière-plan : jusqu’à 500 animaux, progression visible, fiche en cours, résultat récupérable au retour sur la page et bouton de téléchargement explicite. Un seul ZIP regroupe les PDF A4 par lots de dix pages, ce qui évite les téléchargements multiples bloqués par le navigateur. Les pages sont compressées en JPEG de qualité d’impression avant inclusion dans les PDF ; la limite des 80 Mo d’images PNG intermédiaires ne bloque plus l’export des grandes sélections. Les photos indisponibles sont signalées individuellement et les fiches réussies restent téléchargeables. L’export est privé et temporaire (24 heures).

Migration SQLite **17 → 18** : extension des rôles et tables des demandes/états Google. Migration transactionnelle conservant les identifiants, sessions, références et données existantes. Aucun changement des volumes Docker ni traitement des originaux sur le NAS. Nouvelle dépendance officielle `google-auth-library`, lockfile régénéré par npm.

[Validation et limites](../../VALIDATION.md) · [Déploiement](../DEPLOIEMENT.md).
