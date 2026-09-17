# Comptes et sécurité communautaire — préparation mobile

Cette livraison prépare la première étape de publication mobile : suppression du compte, signalement des utilisateurs et blocage côté serveur. Les deux migrations et les trois fonctions serveur sont activées sur Supabase depuis le 17 septembre 2026. Le client v59 est publié sur GitHub Pages : [déploiement réussi du commit a5b1c6a](https://github.com/credixbako-prog/boo-p-by-chatgpt/actions/runs/35214305390), avec 146 tests automatisés réussis. Les sept fichiers publics de cette fonctionnalité correspondent au commit vérifié.

## Suppression du compte

Dans Profil → Préférences → Données personnelles, « Supprimer mon compte » est distinct de « Effacer les données locales ». Le premier demande le mot de passe actuel et la confirmation `SUPPRIMER`. Le second conserve les données en ligne.

La fonction serveur `delete-account` vérifie la session auprès de Supabase Auth, reprend exclusivement l'identité vérifiée, puis vérifie de nouveau le mot de passe. Elle n'accepte aucun identifiant de compte à supprimer fourni par le navigateur. Les mots de passe et jetons ne sont ni journalisés ni conservés par le code de la fonction.

L'ordre de suppression est le suivant :

1. Poser un marqueur privé qui bloque les nouvelles écritures et la synchronisation concurrente ; retirer les inscriptions push et les notifications contenant des copies de l'identité.
2. Effacer les contenus personnels tout en conservant les structures collectives et les contributions des autres lecteurs. Les publications servant de support à des échanges deviennent des emplacements anonymes ; les réponses conservées ne sont plus rattachées à l'identité supprimée. Aucun membre n'est automatiquement promu propriétaire.
3. Fermer les conversations vocales actives. Une conversation commencée simultanément doit être refermée si son inscription serveur échoue.
4. Inventorier les fichiers appartenant au compte, par lots, et supprimer les fichiers avec l'API Storage. Ne jamais supprimer directement les lignes `storage.objects` : cela laisserait les fichiers orphelins.
5. Révoquer les sessions puis effectuer une suppression définitive dans Auth. Les clés étrangères retirent les données personnelles associées. Les contrôles d'activité empêchent un ancien jeton de recréer des données.
6. Après confirmation serveur uniquement, effacer les données de ce navigateur et revenir à l'accueil.

Une interruption peut laisser une suppression partielle. Le message utilisateur l'indique et permet de relancer avec le mot de passe, y compris après rechargement ou reconnexion. Le client vérifie alors le marqueur avant de créer un profil ou de synchroniser des données. Le marqueur reste actif pour empêcher le repeuplement des données ; la procédure reprend sans restaurer les éléments déjà effacés. La suppression des fichiers, d'Auth et de la base traverse plusieurs services : elle n'est pas une transaction unique. Ne pas retirer manuellement le marqueur pour résoudre un incident.

Un appel vocal encore en cours de démarrage bloque temporairement la préparation de la suppression. Le lecteur doit fermer cet appel puis réessayer ; aucun marqueur de suppression n'est posé tant que ce démarrage reste en attente dans la fenêtre de protection.

Les copies déjà exportées, les données conservées hors ligne sur d'autres appareils, les sauvegardes et les journaux des prestataires ne sont pas effacés par ce seul parcours. Leur conservation et leur purge restent à documenter dans la politique de confidentialité. Cette livraison n'est pas une certification RGPD ou App Store.

## Signalements et blocages

Le menu du profil d'un autre lecteur propose un signalement enregistré dans `user_reports`. L'auteur peut consulter ses propres signalements ; la personne signalée ne peut pas les lire. Les rôles administrateur et modérateur sont attribués **côté serveur** dans la table privée décrite par le [guide d'administration](STAFF_ACCESS.md). Ni les métadonnées utilisateur ni un ancien jeton ne permettent de contourner une révocation.

Les signalements de publications continuent d'utiliser `publication_reports`. Le panneau de modération de BOO-P réunit les deux files et permet de marquer les signalements comme traités, de les classer sans suite ou de les rouvrir. Les changements de statut passent par une fonction serveur contrôlée et journalisée. Les politiques de lecture des contenus restent appliquées aux aperçus. Aucun e-mail ou message de modération externe n'est envoyé automatiquement.

Le blocage est enregistré dans `user_blocks`, retiré de cette table lors du déblocage et rechargé à l'ouverture/reprise de l'application. Il masque les profils et contributions entre comptes concernés, interdit les nouvelles interactions directes et demandes d'amitié, retire l'amitié existante et les notifications concernées. Le déblocage ne recrée pas une amitié. Les lectures privées et les contributions d'autres membres restent conservées.

Un blocage protège les interactions entre comptes identifiés ; il ne rend pas privés les contenus déjà publiés à tous, consultables sans connexion. Les liens de médias déjà signés restent valables jusqu'à leur expiration. La modération autorisée conserve les accès nécessaires à l'examen des publications.

## Mise en service

Appliquer dans cet ordre, sans exécuter de suppression sur un compte réel pour vérifier le déploiement :

1. Migration `20260917110001_community_user_safety.sql`.
2. Migration `20260917110019_account_deletion.sql`.
3. Fonction Edge `delete-account` (`index.ts` et `core.mjs`). Elle utilise les secrets serveur Supabase existants. La clé OpenAI n'est nécessaire que si un appel vocal actif doit être fermé ; une clé absente dans ce cas bloque la suppression au lieu de perdre l'identifiant de l'appel.
4. Mise à jour de la fonction `reading-voice`, qui ferme un appel créé pendant une suppression de compte, et de `push-notifications`, qui revérifie une notification déjà chargée avant livraison après un blocage.
5. Client web et cache PWA v59.

Le corps de `delete-account` effectue sa propre authentification par `/auth/v1/user`, même si la vérification JWT de la passerelle est activée. Pour un projet utilisant des clés de signature asymétriques non prises en charge par cette vérification de passerelle, configurer cette option conformément aux autres fonctions authentifiées du projet, sans retirer le contrôle d'identité dans la fonction.

En cas de rollback du client, conserver les migrations de protection. Ne pas revenir à des clés étrangères supprimant les contributions d'autrui et ne pas supprimer la table des blocages.

## Vérification

Validation locale terminée le 17 septembre 2026 :

- **152 tests JavaScript réussis**, avec `node --test tests/*.test.mjs`.
- **24 migrations et 7 suites SQL réussies**, avec `node tools/test-safety-sql.mjs`. Le script utilise une base PostgreSQL en mémoire via PGlite 0.5.8 et écrit le résultat dans `.tmp/safety-sql-receipt.json`. Il découvre l'installation locale existante ; ailleurs, installer `@electric-sql/pglite` ou définir `PGLITE_MODULE` avec le chemin de ce paquet.
- **Parcours Chrome réussis** aux largeurs 320, 390 et 1365 pixels, avec `tests/safety-journeys.cjs` : erreurs et reprises des signalements, blocages, déblocages et suppressions, ainsi que reprise d'une suppression après rechargement. Le script accepte `PLAYWRIGHT_MODULE`, `CHROME_PATH` et `BOOP_TEST_URL` pour le runtime et le serveur local.

Le socle SQL local reconstitue les cinq tables initiales absentes de l'historique des migrations du dépôt et un modèle minimal des métadonnées Auth/Storage. Toutes les migrations du dépôt sont ensuite exécutées. Les appels réseau de PostgreSQL sont neutralisés. Cette vérification ne certifie pas l'identité du schéma distant, les connexions concurrentes ni la configuration des services hébergés.

Les tests `tests/community-safety-access.sql` et `tests/account-deletion-access.sql` s'exécutent après les migrations dans des transactions annulées. Ils ne doivent utiliser que leurs comptes synthétiques ; aucune suppression d'un utilisateur existant ni aucun fichier réel n'est nécessaire.

Les tests du serveur simulent Auth, Storage et la fermeture vocale : session invalide, mot de passe incorrect, identité forgée, lots de fichiers, interruption, révocation des sessions et échec de suppression. Les tests d'interface couvrent la conservation des données locales avant confirmation et les erreurs des opérations de sécurité. Le parcours navigateur utilise des doubles de test et bloque les requêtes Supabase réelles.

La vérification en transaction SQL valide les règles de base ; elle ne remplace pas un essai complet Auth/Storage sur un compte de test dédié après activation des fonctions.

Après activation sur le projet Supabase `shnyjvinzjvgourpscvh`, les deux suites SQL de sécurité communautaire et de suppression du compte ont également réussi sur la base hébergée, avec annulation des données synthétiques. Versions serveur actives : `delete-account` v1, `reading-voice` v7 et `push-notifications` v3.

Les vérifications HTTP avec deux comptes dédiés sans envoi d'e-mail ont réussi sur Auth, la base et Storage réels : signalement privé, refus d'identité forgée, blocage bilatéral, refus d'accès aux médias et aux interactions après blocage, déblocage, refus de suppression avec mauvais mot de passe, suppression complète d'un compte et de ses fichiers, refus du renouvellement de session et des écritures avec l'ancien jeton. La suppression du premier compte a préservé le second compte, son livre privé et son fichier.

Le parcours Chrome sur le site public a ensuite réussi sans simulation : connexion du second compte, synchronisation de son livre, mauvais mot de passe refusé par la fonction hébergée (HTTP 403) sans effacement local, puis suppression confirmée (HTTP 200), retour à l'accueil et effacement du cache personnel et de la session. Aucune exception JavaScript. Le contrôle SQL final confirme l'absence des deux comptes de test et de leurs données dans Auth, les identités, sessions, profils, annuaire, livres, signalements, blocages, Storage et marqueurs de suppression. Les mots de passe synthétiques locaux ont été effacés.

La publication ciblée part du dernier `main` distant et conserve les suggestions de livres existantes. Le commit local préparant de nouvelles recommandations reste séparé ; les 6 tests de cette évolution expliquent la différence entre les 152 tests du dossier de travail et les 146 tests de cette livraison.

Le contrôle Supabase ne relève aucune nouvelle alerte de sécurité nécessitant une correction dans cette livraison. Le marqueur privé de suppression est volontairement inaccessible aux clients (RLS sans politique permissive). L'avertissement préexistant concernant la [protection contre les mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) reste présent ; ce réglage Auth n'a pas été modifié.
