# Administration et modération BOO-P

Les rôles de l’application sont distincts des accès techniques à Supabase, GitHub et Hostinger. Ils sont attribués à un identifiant de compte Auth confirmé, jamais automatiquement à partir d’une adresse e-mail.

## Capacités

- Un modérateur peut examiner les signalements de lecteurs et de publications, les marquer comme traités, les classer sans suite ou les rouvrir. Les menus des publications partagées proposent les actions de modération prévues par leurs politiques d’accès.
- Un administrateur dispose également de la liste paginée des comptes et peut attribuer ou retirer les rôles administrateur et modérateur. Il dispose des capacités de modération.
- Ces rôles ne permettent pas de lire les carnets personnels privés, de modifier les mots de passe ni d’accéder aux comptes techniques des fournisseurs.

Le panneau est accessible depuis les préférences du profil. Les données administratives restent en mémoire pendant la session et ne sont pas copiées dans le stockage local de l’application.

## Contrôle des droits

Les droits sont conservés dans `private.boop_staff_roles`, inaccessible directement aux clients. Les fonctions serveur vérifient le rôle actuel, l’existence du compte et son activité. Les métadonnées fournies par un utilisateur ne peuvent pas lui donner un rôle. Un ancien jeton ne conserve pas un droit retiré dans la table.

Les rôles de modération déjà attribués dans les métadonnées serveur sont repris par la migration. Après cette migration, la table privée constitue la source d’autorité. Les rôles propres aux clubs restent distincts.

Les fonctions de gestion de rôles contrôlent la présence d’un autre administrateur actif avant de retirer le dernier rôle d’administrateur. Le démarrage de la suppression du dernier compte administrateur est également refusé, avant l’effacement des données. Le titulaire doit d’abord transmettre l’administration à un autre compte confirmé.

Les changements de rôles et le traitement des signalements sont journalisés côté serveur. Les administrateurs ne reçoivent pas de clé de service Supabase.

## Déploiement

1. Appliquer la migration `20260917130000_staff_roles.sql`.
2. Déployer la fonction `delete-account` pour afficher l’explication du refus de suppression du dernier administrateur.
3. Publier le client et le cache PWA v60.
4. Attribuer les premiers rôles par une opération serveur ciblée, après vérification du compte destinataire. Aucun compte réel n’est inscrit en dur dans la migration.

## Vérification

Les tests SQL s’exécutent avec `node tools/test-safety-sql.mjs`, après toutes les migrations, dans une base locale isolée. Ils utilisent uniquement des comptes synthétiques dans des transactions annulées. Le scénario du dernier administrateur suppose cette base isolée et ne doit pas être lancé en production. Les tests JavaScript couvrent les changements de session, les refus d’accès et les erreurs des opérations administratives.

Le contrôle du compte réel se limite à son attribution de rôles et à la lecture des droits résultants. Aucun autre utilisateur réel ne doit être modifié pour tester cette fonctionnalité.

Validation du 17 septembre 2026 : 156 tests JavaScript réussis, 8 suites SQL locales réussies, contrôle ciblé de migration des anciens rôles et de détachement de l’acteur d’audit réussi. Parcours de modification de rôle et de traitement d’un signalement vérifiés dans Chrome avec des données fictives, affichage mobile contrôlé. Migration distante appliquée et fonction `delete-account` déployée en version 2.
