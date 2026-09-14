# BOO-P — Carrousels, citations et Lexique

Version préparée le 14 septembre 2026 à partir des six annotations de suivi et des deux annotations sur la mémoire et le Lexique. Modifications validées localement et publication autorisée pour le commit `5f359ca`. La migration de production est appliquée et vérifiée. Le nom du fichier reprend la version attribuée par le serveur Supabase.

## Comportements

| Commentaire | Résultat |
| --- | --- |
| 1 et 5 — Points de navigation | Les citations, cartes de lecture et livres des profils utilisent des points gris de 6 px, avec une pastille sauge de 20 px pour la sélection, comme les mots à retrouver. Les points restent des boutons accessibles. |
| 2 — Taille des citations | Le cadre prend la largeur des cartes mémoire, au maximum 680 px, et une hauteur constante de 330 px (350 px jusqu’à 400 px de largeur d’écran). La police diminue selon le contenu, jusqu’à 12 px. Au-delà, un bouton ouvre la citation entière dans une fenêtre de lecture ; le cadre ne grandit pas. |
| 3 et 4 — Livres des profils | Les lectures en cours et les livres à découvrir défilent horizontalement, un livre à la fois, avec points de navigation et commandes clavier. Les encouragements et Traces restent associés à leur livre. Les couvertures du catalogue concerné sont conservées par la projection serveur et par le rendu client. |
| 6 — Citation de la fiche de lecture | Les citations enregistrées pour le livre alimentent la question : toutes par défaut, ou une citation choisie. Auteur et page accompagnent le texte. La saisie personnelle reste possible. Les anciennes réponses écrites sont conservées comme saisie personnelle. |
| Ajout 1 — Sens des cartes mémoire | Une carte présente la définition pour retrouver le mot ; la suivante présente le mot pour retrouver sa définition. Le sens reste stable lorsqu’une carte revient après « À revoir ». Le suivi des révisions reste commun au mot. |
| Ajout 2 — Lexique dépliable | Les mots et expressions apparaissent dans une seule liste, fermés au départ. Le clic, Entrée ou Espace ouvre et referme définition, contexte, source et actions. Recherche, filtres, modification et partage restent disponibles. Les citations et pensées du Carnet conservent leur présentation. |

## Couvertures : cause et correction

Les livres signalés possèdent bien une couverture dans la bibliothèque. Leurs URL proviennent de `images.chasse-aux-livres.fr` et `img.chasse-aux-livres.fr`, absents de la liste des sources autorisées dans `private.reader_book_card` et dans le client. La projection retournait donc une chaîne vide.

La migration `20260914141454_reader_catalog_cover_sources.sql` ajoute uniquement ces deux hôtes précis. La restriction propriétaire/ami accepté et la sélection des champs visibles restent en place. Les fiches de lecture, réflexions et autres notes privées ne sont pas exposées. Les domaines trompeurs restent rejetés. Aucune réimportation des livres n’est nécessaire.

Les trois URL réelles des couvertures signalées ont été chargées et décodées dans Chrome. Les réponses de profil du test navigateur sont simulées, mais les images sont effectivement téléchargées depuis leur source. La projection serveur a été vérifiée sur PostgreSQL isolé ; la migration est désormais appliquée en production. Les quatre fiches concernées conservent maintenant leur URL de couverture. Les hôtes trompeurs sont refusés et les champs privés restent exclus de la projection.

## Conservation des citations

`book.readingSheet.quoteSource` mémorise `all`, l’identifiant d’une citation ou `manual`. Le texte associé est conservé dans la fiche privée. À sa réouverture, les citations liées sont actualisées depuis le Lexique du livre. Une citation sélectionnée puis supprimée laisse son dernier texte en saisie personnelle. Passer temporairement à une sélection automatique puis revenir à la saisie personnelle restaure le texte en cours.

## Vérifications

- `node --test tests/*.test.mjs` : 113 tests réussis.
- `tests/reading-carousel-journeys.cjs` : cadre et largeur à 320, 390, 769 et 1294 px, adaptation typographique, ouverture du texte complet, pagination, citations liées à la fiche et couvertures réelles des profils.
- `tests/lexicon-memory-journeys.cjs` : deux sens de rappel, retournement accessible, stabilité après révision, remplacement d’un mot retrouvé, ouverture/fermeture au clavier, modification, recherche, filtres et liste responsive.
- Régressions : `reading-experience-journeys`, `reader-profile-journeys` et `notebook-experience-journeys` réussis.
- `tests/reading-experience-rls.cjs` : migration exécutée sur PostgreSQL via PGlite 0.5.8 ; contrôles d’accès existants et rejet des hôtes trompeurs réussis.
- `tests/reader-profile-access.sql` : contrôle réussi en production des couvertures de catalogue, de la projection privée et des accès propriétaire/ami/étranger/anonyme, avec rollback intégral et aucun utilisateur de test restant. Aucun nouveau constat du conseiller de sécurité.
- Cache PWA v57 : rechargement hors connexion et conservation du brouillon vérifiés.

Les tests navigateur utilisent Chrome et des données isolées. Aucune publication ni bibliothèque d’un lecteur réel n’a été modifiée.
