# Partages entre lecteurs — 11 septembre 2026

Depuis le profil d’un lecteur, trois onglets présentent **Son parcours**, sa **Bibliothèque** et ses **Carnets**. Le [guide des profils](READER_PROFILES.md) décrit les lectures en cours et les nouvelles interactions. La bibliothèque devient accessible après acceptation de l’amitié, dans les deux sens. Elle présente les titres, auteurs, couvertures de catalogue autorisées et statuts des livres synchronisés, par pages de 24. La wishlist, les notes, les positions de lecture, les brouillons et les conversations avec l’IA restent privés.

## Publier volontairement

Un bouton **Partager** est disponible sur les mots, expressions, citations et pensées. Le carnet de réflexion propose **Partager le carnet** ; la fiche du livre propose **Partager ma lecture**, puis le début ou la fin du livre. Le bilan de session permet de préparer une publication après enregistrement ; si le livre est terminé, l’animation de félicitations précède cette préparation. Rien n’est publié par le seul enregistrement d’une lecture.

Le lecteur retrouve un message proposé, peut le modifier et ajouter son propre texte, puis modifier aussi le contenu partagé. Un aperçu précède le bouton **Publier**. L’audience initiale est **Amis uniquement** ; **Communauté** rend la publication publique, y compris sans compte. Ce choix est explicite dans l’interface.

Exemples de propositions :

- Mot : « Un nouveau mot rejoint mon lexique : “…” . Je vous partage cette découverte. »
- Expression : « Une expression a retenu mon attention : “…”. Je vous la partage. »
- Citation : « Quelques mots qui résonnent encore après la lecture. Et vous, que vous évoquent-ils ? »
- Pensée : « Une pensée née de ma lecture, que j’ai envie de partager avec vous. »
- Début : « J’ouvre “…” : une nouvelle lecture commence. L’avez-vous déjà lu ? »
- Fin : « Je viens de refermer “…”. Une lecture de plus, et des idées qui continuent leur chemin. »

Une publication est une **copie choisie**. Modifier cette copie ne modifie pas l’original personnel ; modifier l’original ne met pas à jour automatiquement la publication. Le carnet reprend uniquement le texte et les sections enregistrés, sans brouillons ni messages IA. Les notes privées associées aux mots ne sont pas reprises.

Revenir sur **Partager**, ou choisir **Modifier ou retirer** dans sa publication, permet de la mettre à jour ou de la retirer. Le contenu personnel reste conservé. Un seul partage existe par contenu et type d’événement : publier à nouveau le même élément met à jour sa publication. Un nouveau début de lecture du même livre réutilise donc sa publication de début précédente.

## Accès et stockage

La migration `20260911144213_reader_sharing.sql` ajoute trois champs à `community_posts` : `reading_kind`, `reading_source_id`, `reading_content`, avec validation et unicité par auteur/type/source. Elle a été appliquée et vérifiée sur Supabase le 11 septembre 2026. Le nom local reprend la version enregistrée par le service de migration distant. Les règles RLS contrôlent l’auteur et l’audience côté serveur. Les commentaires, encouragements et photos suivent la visibilité de leur publication. Les publications existantes ayant déjà l’audience `friends` deviennent effectivement visibles aux amis acceptés.

La fonction publique `get_reader_library` est réservée aux comptes authentifiés et délègue à une fonction privée qui vérifie l’amitié avant de projeter une liste limitée de champs. Le JSON personnel `user_books` reste inaccessible aux autres lecteurs. Aucune conversation IA n’est exposée par cette fonction.

Retirer une amitié révoque côté serveur l’accès à la bibliothèque et aux publications réservées aux amis. Le fil est rechargé au retour dans l’application, et le contenu d’une publication est relu sur le serveur à son ouverture. Les publications distantes ne sont pas conservées dans le stockage local du fil. Une copie déjà vue, photographiée ou exportée par un lecteur ne peut pas être récupérée à distance.

Le blocage existant reste un masquage local : il ne remplace pas le retrait d’amitié pour révoquer ces accès. Les contenus publics restent publics même après un retrait d’amitié. Le mode invité permet un aperçu du partage, sans écriture distante.

## Vérification

- `node --test tests/*.test.mjs` : données personnelles, construction des copies, absence de persistance du fil distant et changement de compte pendant un appel.
- `node tests/reading-sharing-journeys.cjs` : navigateur mobile et ordinateur, édition, aperçu, audiences, retrait, erreur réseau, carnet, pagination et bilan de fin de livre. Même configuration Playwright que les autres parcours ; les API sont simulées et aucune publication réelle n’est envoyée.
- `tests/reader-sharing-access.sql` : fixtures transactionnelles avec annulation finale pour vérifier propriétaire, visiteur anonyme, étranger, amitié en attente/acceptée/retirée, pagination et isolement des données personnelles. À exécuter après la migration ; ne pas retirer le `rollback`.

Les parcours avec deux comptes réels sur des appareils distincts restent à essayer après publication de l’interface.

Résultats au 11 septembre : 90 tests Node réussis, parcours navigateur mobile/ordinateur réussis et contrôles transactionnels RLS réussis après application. Aucun nouvel avis de sécurité Supabase. Les quatre tables techniques déjà fermées par RLS sans accès client restent inchangées ; l’avertissement préexistant sur la [protection contre les mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) reste à traiter séparément.
