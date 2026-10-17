# AniPic 3.5.3

Après la saisie du PIN initial, **l’autorisation du navigateur n’expire plus côté AniPic**. Elle reste valable après une déconnexion du compte, un redémarrage ou une mise à jour qui conserve SQLite. Changer le PIN ou désactiver/réactiver la protection révoque les autorisations précédentes. Les sessions des comptes gardent leur propre expiration et leurs droits habituels.

Le navigateur conserve uniquement un jeton aléatoire, dans un cookie HttpOnly, SameSite=Strict et Secure en HTTPS. Le PIN lui-même n’y est jamais enregistré. Le cookie est renouvelé pour 400 jours à l’ouverture de l’application et lors du rafraîchissement du programme TV. L’autorisation dans SQLite n’a aucune échéance ; la conservation effective dans le navigateur dépend toujours de ses cookies. Effacer les cookies, changer de navigateur ou de domaine, ou quitter la navigation privée peut donc nécessiter une nouvelle saisie.

Les anciennes autorisations encore valides deviennent permanentes au retour dans l’application ou sur la TV. Les autorisations déjà expirées ou révoquées restent refusées. La valeur vide du champ `site_passes.expires_at` indique une autorisation permanente ; le nettoyage au démarrage la conserve. Aucune migration ni dépendance supplémentaire.

Les agents SPA conservent l’accès à la configuration de l’écran du refuge, sans accès aux paramètres généraux. Les volumes, chemins NAS et protections Docker restent inchangés. [Vérifications et limites](VALIDATION.md).
