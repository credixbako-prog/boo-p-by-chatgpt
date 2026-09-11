# BOO-P — portrait et badges du lecteur

Évolution du 11 septembre 2026. Migration `supabase/migrations/20260911195339_reader_badges.sql` appliquée après autorisation explicite et vérifiée. Interface prête pour publication.

## Profil

Le profil personnel présente identité, dernier badge automatique et biographie, puis une rangée Modifier / Voir mon profil. Modifier regroupe Photo et identité et Mon espace de lecteur. Le raccourci de réglages reste en haut à droite ; le thème se trouve avec Compte et préférences.

L’ADN utilise une phrase en 16 px, deux genres au maximum et un petit symbole. Ses justificatifs sont repliables ; l’historique reste accessible. Suivent trois badges récents, Mes objectifs et Statistiques (fermées par défaut), puis les préférences du compte. La carte de lecture à partager se trouve en dernière section de l’accueil.

## Collection initiale : 30 badges

| Badge | Condition |
|---|---|
| Premier pas | Une session enregistrée |
| Entre deux pages | Deux livres en cours |
| Dernière page | Un livre terminé |
| Quelques escales | Cinq livres terminés |
| Un beau chemin | Dix livres terminés |
| Bibliothèque vivante | Vingt-cinq livres terminés |
| Grand voyage | Cinquante livres terminés |
| Premier mot | Un mot conservé |
| Mot après mot | Dix entrées de lexique, critère historique conservé |
| Collectionneur de mots | Vingt-cinq mots |
| Trésor de mots | Cent mots |
| L’art de dire | Dix expressions |
| Échos de lecture | Dix citations |
| Première pensée | Une Trace personnelle |
| Trace profonde | Une Trace personnelle liée à un livre terminé |
| Au fil des pensées | Dix Traces personnelles |
| Carnet ouvert | Un carnet renseigné, sans obligation de conversation IA |
| Cinq regards | Cinq livres avec un carnet renseigné |
| Le temps suspendu | Une session d’au moins soixante minutes |
| Dix rendez-vous | Dix sessions enregistrées |
| Compagnon des pages | Cinquante sessions enregistrées |
| Du temps pour soi | Dix heures de sessions enregistrées cumulées |
| Journée accomplie | Objectif du jour atteint |
| Semaine accomplie | Objectif hebdomadaire atteint |
| Mois accompli | Objectif mensuel atteint |
| Année accomplie | Objectif annuel atteint |
| Curiosité ouverte | Papier, ebook et audio dans la bibliothèque |
| Hors des sentiers | Livres terminés dans trois genres, hors À classer |
| Horizons multiples | Livres terminés dans cinq genres |
| Passeur de livres | Un livre prêté ou donné |

Les dix identifiants historiques et leurs dates acquises sont conservés. Les seuils sont des jalons personnels calculés à partir des données saisies : ils ne sont pas une certification ni une preuve d’une lecture effectuée. Aucun achat, appel IA ou publication publique n’est requis. Un carnet rempli signifie qu’au moins une section de texte est non vide ; une conversation seule ne suffit pas.

## Présentation et célébration

Les illustrations SVG locales utilisent ivoire, bleu nuit, sauge et ocre. Livres, lettres, plume, sablier, chemin, boussole et transmission constituent les familles graphiques, avec variantes et repères de niveau. Elles restent fixes dans le profil et la collection.

Le dernier badge est choisi automatiquement par date d’obtention décroissante, puis identifiant croissant pour départager les égalités. Le lecteur ne choisit pas un badge à épingler. Le clic sur le badge du profil ouvre sa signification. Les trois badges récents du profil personnel ouvrent la collection.

Une obtention déclenche une carte animée d’environ 3,2 secondes, fermable immédiatement. Plusieurs badges obtenus ensemble sont regroupés pendant 5 secondes. La célébration attend que la page soit visible, qu’aucun dialogue ne soit ouvert et qu’aucun champ ne soit en cours de saisie. Le livre terminé garde sa propre célébration ; les badges attendent leur tour. Échap et bouton de fermeture sont disponibles ; le focus revient à l’élément précédent s’il existe toujours. La préférence système de réduction des mouvements désactive les animations.

Le premier chargement du nouveau catalogue, la récupération de données et les acquis synchronisés ne rejouent pas les anciennes célébrations. Les acquis persistent même si un élément est supprimé ensuite. Effacer les données locales ne supprime pas les acquis synchronisés du compte.

## Synchronisation et accès — migration appliquée

`reader_badges` conserve uniquement `user_id`, `badge_id` et `unlocked_at`. Le propriétaire peut lire ses acquis et insérer ceux calculés par l’application. Les doublons sont ignorés ; les dates déjà enregistrées ne sont pas modifiables par le client. Les badges restent disponibles localement en cas de panne réseau et la synchronisation est retentée lors d’une mutation, d’un retour sur la page ou du retour en ligne.

Les autres lecteurs n’accèdent pas à la collection complète. `get_reader_latest_badge` projette uniquement le dernier identifiant et sa date aux utilisateurs connectés autorisés par la visibilité du profil ou une amitié acceptée. Les contenus des carnets, conversations, livres et lexiques ne sont pas joints au badge. Le blocage local existant ne remplace pas le retrait d’amitié. Les comptes publics gardent un badge accessible à la communauté connectée. La suppression du compte supprime la collection par cascade.

Après autorisation explicite, la migration a été appliquée et `tests/reader-badges-access.sql` exécuté avec données fictives et annulation transactionnelle. Les assertions passent : accès propriétaire, lecture du seul dernier badge pour l’ami, profil public/privé, retrait d’amitié, accès anonyme, doublons, identifiants invalides et écriture sur autrui. Les avis de sécurité Supabase ne signalent rien de nouveau. Les quatre tables techniques fermées restent sans politique client ; l’avertissement préexistant de [protection des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) reste distinct de cette évolution.

## Vérification locale

96 tests Node passent. `tests/reader-badges-journeys.cjs` vérifie le profil à 320, 390 et 1024 px, les 30 SVG, l’ADN en 16 px, les statistiques repliables, la personnalisation, l’attente des dialogues, la réduction des mouvements, la fermeture automatique et l’absence de répétition. Les captures sont dans `.tmp/badges-review/`. Les parcours de profil ami utilisent des API simulées ; la synchronisation entre deux appareils réels devra être essayée après publication de l’interface.

Les suites `reading-journeys.cjs`, `reader-profile-journeys.cjs` et `reading-sharing-journeys.cjs` passent également : lecture, carnet, sauvegarde et récupération de brouillons, catalogue simulé, bibliothèque, Sentier, réglages, thème sombre, interactions entre amis, badge près du nom, droits de publication et changement de compte. Le test historique du carnet pointe maintenant vers l’onglet Carnet ; les célébrations sont fermées par le test général et vérifiées séparément dans leur parcours dédié.
