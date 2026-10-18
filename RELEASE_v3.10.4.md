# AniPic 3.10.4 — Les mouvements du refuge, plus lisibles

- **Au fil du refuge** : pictogramme + pour les arrivées, cœur pour les adoptions, signe − pour les autres départs et flèche de retour. Les adoptions automatiques encore à vérifier ont une couleur et un libellé distincts. Date et heure visibles ; actualisation chaque minute et au retour sur la fenêtre.
- **Adoptions à confirmer** dans le menu du refuge : compteur actualisé, portraits locaux ou SPA, date de détection et confirmation par les agents SPA ou administrateurs. Les adoptions automatiques sont déjà archivées et comptées ; la validation de l’équipe ne crée jamais une deuxième adoption. Elle est conservée et journalisée avec son auteur. Une réapparition SPA corrige le départ, y compris après validation.
- **Profil de synchronisation rapide** : bouton dans les réglages de synchronisation pour appliquer 2 confirmations espacées de 30 minutes, une synchronisation interne toutes les 15 minutes et 3 passages par collecte. Enregistrer les paramètres pour l’activer. Les réglages existants restent conservés lors de la mise à jour ; la crontab de l’hôte n’est pas modifiée.
- **Grande affiche, « Les regards dans le logo »** : portraits dans la silhouette SPA, noms toujours visibles sur des bandeaux, disposition équilibrée sans superposition, QR facultatif et exports A4/A3/A2 en PNG/PDF. Pour de nombreuses photos, privilégier A2. Le logo officiel transparent reste affiché en tête.

La file des adoptions est réservée aux comptes agent/admin, avec contrôle de session, CSRF, protection contre les validations périmées et confirmation idempotente. Les exports CSV et badges distinguent une validation par l’équipe d’une simple déduction automatique. Aucune migration SQLite ni modification des volumes Docker/NAS.

Consulter [VALIDATION.md](VALIDATION.md) pour les contrôles réellement exécutés et leurs limites. L’archive source n’est pas une publication d’image GHCR : le déploiement depuis Git compile avec `compose.yml` ; une image de registre doit être publiée par le workflow avant d’utiliser `portainer-ghcr.yml`.

© Gaerisson · AniPic
