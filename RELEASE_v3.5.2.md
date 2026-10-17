# AniPic 3.5.2

**Le refuge → Écran du refuge** est accessible aux comptes **Agent SPA** et **Administrateur**. Les agents peuvent régler les espèces, les animaux masqués, les styles, les messages, la timeline et les horaires, prévisualiser puis enregistrer le programme. La page utilise uniquement son API dédiée, sans demander les paramètres généraux de l’administration. Les visiteurs, lecteurs et photographes ne peuvent pas modifier la diffusion. Un agent ne peut pas utiliser cette API pour changer le PIN, les comptes ou l’activation de l’historique public. Les protections de session, réseau et CSRF sont conservées.

Après la saisie correcte du PIN initial, le navigateur conserve une autorisation privée pendant **30 jours**, prolongée au fil des visites et pendant la lecture continue de la TV. Le cookie possède une expiration persistante, indépendante de la session de compte de 12 heures. Un rechargement, une fermeture d’onglet, une déconnexion de compte ou une mise à jour du serveur conservant SQLite ne doit donc pas redemander le PIN tant que cette autorisation reste valide. Le PIN lui-même n’est jamais stocké dans le navigateur ; seul un jeton aléatoire privé est conservé. Un changement du PIN révoque les autorisations précédentes. Un jeton expiré ou révoqué ne peut pas être prolongé.

La mémorisation est propre au navigateur et au domaine utilisés. L’effacement des cookies ou la fin d’une session de navigation privée supprime cette mémorisation.

Aucune migration SQLite ni nouvelle dépendance. Les volumes et les montages Docker sont inchangés. [Vérifications et limites](VALIDATION.md).
