# Correction de synchronisation — déployée sur l’instance de test

## Statut

Déploiement autorisé et réalisé le 9 septembre 2026 sur l’instance de test BOO-P existante. Client publié : commit `c172f51e9177e4eeedfe5bdda0b9d16c5cfbfdf5`, workflow GitHub Pages `34348145297` terminé avec succès. Vérification HTTP du cache v39 et du RPC dans le script réellement servi. Migration `20260909115653_atomic_personal_sync.sql` appliquée au projet Supabase `shnyjvinzjvgourpscvh` après publication du client. Les protections sociales de la livraison précédente restent actives.

Les tests PostgreSQL ont été réexécutés après application, sous le rôle authenticated, dans une transaction annulée avec des comptes synthétiques. Résultat : succès. Les écritures directes sont refusées, le RPC est accessible aux utilisateurs authentifiés et interdit aux anonymes. Aucun compte de test n’est conservé. Les 51 tests JavaScript passent. La page d’accueil et l’application en mode invité s’ouvrent dans le navigateur intégré ; aucun test authentifié de deux appareils physiques n’a été réalisé.

## Comportement

- Une base de synchronisation exacte est conservée dans les métadonnées du carnet local.
- Un RPC reçoit cette base et l’instantané modifié. Le serveur compare les éléments par identifiant et n’applique que les différences locales.
- Les nouveaux éléments distants absents de la base locale restent conservés. Une suppression nécessite une différence explicite entre base et copie locale.
- Une suppression de livre incompatible avec une session, Trace ou entrée liée conservée à distance est refusée ; une nouvelle session ne peut pas être rattachée à un livre connu de la copie locale mais supprimé à distance.
- Une modification concurrente du même élément bloque toute la transaction ; aucune préférence silencieuse pour l’appareil le plus récent.
- Les cinq collections sont enregistrées dans une transaction, sérialisée par compte. Une erreur ou un conflit annule toutes ses écritures. Un renvoi identique après perte de la réponse est accepté sans dupliquer les données.
- Les anciennes écritures directes sur les tables sont révoquées ; les anciennes méthodes JavaScript refusent également d’écrire. Ne pas rétablir ces droits pour contourner un problème de mise à jour.
- La lecture complète retourne un objet JSON agrégé plutôt qu’une collection limitée par la pagination REST.
- Les modifications locales faites pendant un envoi ne sont pas marquées comme déjà synchronisées et ne sont pas remplacées par sa réponse.

## Reprise et migration des anciennes copies

Une ancienne copie modifiée sans base fiable reste sur l’appareil et n’écrase pas la base distante. Dans Réglages → Données et aide, « Reprendre la version synchronisée » demande confirmation, exporte la copie locale, conserve une sauvegarde locale supplémentaire puis charge la version en ligne. « Exporter les copies de récupération » permet de retrouver ces sauvegardes. Un stockage saturé empêche la reprise avant de remplacer la copie.

Les sauvegardes de récupération sont privées au compte dans localStorage et sont retirées par l’effacement local. Elles ne sont pas supprimées par une simple déconnexion. Les exports téléchargés restent sous le contrôle de l’utilisateur. La réintégration d’un choix provenant d’un export reste manuelle ; aucun import automatique ni fusion champ par champ n’est annoncé.

## Validation

`node --test tests/*.test.mjs` : tests applicatifs et RPC simulés, conflits, mode invité, réponse incomplète, acquittement de l’instantané réellement envoyé et effacement local.

`security/atomic-sync-regression.sql` : exécuté dans PostgreSQL après la migration, sous le rôle authenticated, le tout dans BEGIN/ROLLBACK. Vérifie ajout distant conservé, modification concurrente refusée, reprise idempotente, erreur tardive annulant les écritures antérieures, suppression explicite, absence de résurrection d’un élément inchangé, interdiction des anciennes écritures, isolation de deux comptes et lecture de 1 207 livres.

Ces essais reproduisent des appareils utilisant des états différents ; ils ne constituent pas un test navigateur de deux connexions réseau simultanées. La coordination des copies locales entre plusieurs onglets et la récupération de données déjà perdues avant correction restent hors de cette livraison.

L’advisor exécuté après migration signale uniquement l’alerte préexistante : [protection contre les mots de passe compromis désactivée](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Déploiement coordonné

1. Conserver une sauvegarde/restauration disponible et publier le client comprenant le cache PWA v39. Avant l’activation des RPC, ce client conserve les changements localement et signale l’indisponibilité de synchronisation.
2. Appliquer la migration atomique, puis refaire les tests de régression dans une transaction annulée et lancer les advisors. Si l’outil attribue une version différente, aligner le nom du fichier sur l’historique réellement enregistré.
3. Vérifier avec deux comptes de test les accès, et avec deux appareils du même compte les ajouts, conflits et copies de récupération. Demander le rechargement des anciennes sessions. Les anciens clients ne pourront plus écrire directement, mais leurs données locales resteront disponibles.
4. Contrôler les erreurs de RPC et les conflits. Un retour à l’ancien client ne doit pas s’accompagner du rétablissement des écritures destructrices : privilégier la conservation locale et une correction en avant.

La publication coordonnée a été effectuée. Les anciennes sessions doivent recharger la page pour utiliser le nouveau client ; leurs tentatives d’écriture via l’ancien protocole sont refusées et leurs données locales restent disponibles.
