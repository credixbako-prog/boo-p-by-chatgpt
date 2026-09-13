# BOO-P — Carnet, Sentier et souvenirs

Version du 13 septembre 2026, préparée localement après validation des 24 annotations. La publication de l’interface et l’application de la migration Supabase restent à autoriser. La version précédente `06275e0` est publiée.

## Parcours retenus

| Annotations | Comportement |
| --- | --- |
| 1, 2, 5 | Carnet distingue Réflexions et Citations. Les citations réutilisent le composant de citation publiée, avec guillemets, italique et attribution. Les anciennes adresses du carnet de cartes redirigent vers Sentier → Cartes et bilans. Cette vue remplace Chronologie. |
| 3, 4 | Les commandes de cadrage et d’agrandissement sont deux pictogrammes distincts dans la carte mentale. Leurs noms accessibles et infobulles sont conservés. |
| 6, 7 | Les longues publications sont limitées à 260 px, avec Plus/Moins seulement en cas de débordement réel. Le menu horizontal ••• regroupe Modifier, Partager, Signaler et Supprimer selon les droits. Il couvre le fil, les profils, les clubs et les cartes. |
| 8–10 | Le texte d’aide des rayons passe à 8 px. La navigation principale reçoit une bande bleu nuit ; les sous-sections restent sur le fond de page. L’entrée de réflexion reçoit un encadré. |
| 11–16 | Les couvertures personnalisées JPEG/PNG/WebP et les sources de catalogue autorisées s’affichent dans les profils accessibles. Bio vide : « bio… ». Confidentialité et gestion de l’amitié sont regroupées dans ••• près du nom. Le crayon du profil personnel précède les réglages. |
| 17–20 | Les souvenirs de l’accueil restent ouverts. Une série de dix citations précède les mots à retrouver ; chaque série dispose de son bouton Mélanger. Le quiz tire dix questions parmi mots, expressions et citations, conserve le dernier résultat et affiche une animation de félicitation ou d’encouragement. |
| 21 | Les cartes déjà créées précèdent la tuile de création sur l’accueil. Le balayage horizontal et les points pleins/vides restent disponibles sur l’accueil et les profils. |
| 22, 23 | L’éditeur de session affiche le titre, l’auteur et le Sujet modifiable. La pensée reste privée et se conserve au bilan. Le bilan propose une Fiche de lecture facultative, retrouvable et modifiable dans Réflexions. |
| 24 | Détection ISBN en continu dans le cadre vidéo, résolution demandée augmentée, mise au point/exposition continues si disponibles, choix d’objectif et éclairage/zoom selon les capacités. Capture et import restent possibles. |

## Données personnelles et mémoire

Les mélanges parcourent toute la collection : une réserve mélangée est épuisée avant d’être renouvelée, sans doublon dans une série de dix. Les petites collections donnent des séries plus courtes ; les exemples existants complètent l’entraînement des mots et du quiz. Mélanger ne modifie pas l’historique de révision. Les réponses au quiz et aux mots conservent la répétition espacée existante. Les sélections sont propres au compte et les textes modifiés sont actualisés sans imposer un nouveau tirage.

La fiche pose neuf questions facultatives : résumé, thème, idées/scènes à retenir, personnages/arguments marquants, citation, accords/désaccords, effet personnel, questions restantes et recommandation. Le choix Roman/récit/théâtre, Essai/document/idées ou Autre adapte les formulations. La fiche est assemblée localement, sans appel IA. Elle est stockée dans `book.readingSheet` et suit la synchronisation privée des livres. Ses réponses ne sont jamais incluses dans la projection des livres d’un profil. Les brouillons de session restent dans la session active ; l’édition ultérieure utilise les brouillons locaux existants. Le Sujet est conservé dans la pensée et dans sa copie publiée, séparé du texte enrichi.

## Bilans annuels

Les années terminées présentes dans les données sont générées à la prochaine ouverture de Sentier → Cartes et bilans. La génération ne s’exécute pas lorsque BOO-P est fermé. Un bouton permet également de créer un bilan, notamment pour l’année en cours. Les bilans restent privés jusqu’à publication explicite.

Le générateur 4:5 réutilise les livres, sessions et souvenirs de l’année, sans extraits de pensées personnelles. Pour les années closes, les événements de statut et les dates de fin permettent de retrouver l’état historique disponible. Une année correspond à `month_key = YYYY`, un mois à `YYYY-MM`. Une identité déterministe par compte et année évite les doublons de génération automatique. Une nouvelle génération demandée par le lecteur conserve une nouvelle image ; elle n’écrase pas une carte déjà publiée.

## Publications et migration

Migration préparée : `supabase/migrations/20260913122256_reading_experience_reports_covers.sql`.

- Les signalements sont enregistrés dans `publication_reports`, pour une publication accessible, avec un seul signalement par lecteur et cible. L’identité, la date et le statut ne peuvent pas être usurpés depuis le formulaire.
- Un auteur peut modifier sa publication ; les textes des clubs disposent d’une politique de modification par auteur membre actif. Les suppressions sont contrôlées en base. Une confirmation indique ce qui sera retiré.
- Le rôle de modérateur global repose exclusivement sur `app_metadata.boop_moderator = true`, attribuable par un administrateur. **Aucun compte modérateur n’est créé ni configuré dans cette version.** Ce rôle permet de lire/traiter les signalements et de retirer les publications partagées. Les cartes privées, pensées originales, fiches et bibliothèques privées ne sont pas ouvertes au modérateur.
- Le partage utilise la feuille native si disponible, sinon copie de texte ou téléchargement de l’image. Seules les publications publiques du fil proposent une adresse directe ; les autres audiences partagent le texte choisi sans modifier leurs permissions.
- La projection de couverture conserve la restriction propriétaire/ami accepté. Elle accepte seulement des images raster bornées et les hôtes explicitement autorisés, sans SVG ni URL arbitraire.

Les conseillers Supabase consultés avant mise en service retrouvent les constats existants : quatre tables techniques fermées sans politique client et la [protection des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) désactivée. La nouvelle migration a été testée dans un PostgreSQL isolé ; les vérifications serveur seront reprises lors de sa mise en service.

## Scanner

Le navigateur utilise `BarcodeDetector` s’il prend en charge EAN-13, sinon ZXing Browser **0.2.1**, déjà utilisé par l’import. La boucle est locale, sans OCR distant par image. Elle exige deux lectures concordantes d’un ISBN 978/979 dont la somme de contrôle est valide. Un seul décodage s’exécute à la fois. Les pistes et la boucle s’arrêtent à la fermeture, au changement de compte, à la sortie de page ou à son passage en arrière-plan.

Les capacités de mise au point suivent l’API [MediaStream Image Capture](https://w3c.github.io/mediacapture-image/) et le décodage de secours utilise [ZXing Browser](https://github.com/zxing-js/browser). Les essais automatisés valident le décodage et le cycle caméra ; ils ne mesurent pas la netteté d’un objectif physique. Un essai sur l’iPhone concerné reste nécessaire.

## Vérification et reproduction

- `node --test tests/*.test.mjs` : 112 tests, dont parcours de toute la collection, synchronisation des fiches, sujet échappé, couvertures, période annuelle et identité des bilans.
- `tests/reading-experience-rls.cjs` : migration exécutée dans PostgreSQL via PGlite **0.5.8**, puis droits auteur, ami, étranger, modérateur et anonyme ; signalements, absence de fuite des fiches et périodes invalides. Installer le moteur de test avec `npm install --prefix .tmp/pg-test --save-exact @electric-sql/pglite@0.5.8`, puis `node tests/reading-experience-rls.cjs`.
- `tests/reading-experience-journeys.cjs` : nouveaux parcours sur 390, 769 et 1294 px, persistance, quiz, menus, modification/suppression de discussion de club, cartes, arrêt automatique de la caméra.
- `tests/isbn-live-journeys.cjs` : véritable décodage ZXing d’un code généré, rejet d’un autre EAN et d’un ISBN invalide, sélection du détecteur natif. `ZXING_FIXTURE` peut désigner une copie du fichier UMD officiel 0.2.1 pour les tests isolés.
- Couvertures personnelles effectivement décodées, bio vide et menu de profil vérifiés ; signalement d’une carte distante depuis son aperçu ouvert en grand.
- Régressions : `notebook-experience-journeys`, `reader-profile-journeys`, `reading-sharing-journeys`, `cards-shelves-journeys`, `reading-journeys`, `ui-polish-journeys`, `reader-badges-journeys`.
- Cache PWA **v56**, avec les nouveaux modules ; éditeur et brouillon vérifiés après rechargement hors connexion.

Les tests navigateur utilisent Chrome et des données isolées. Aucune publication de lecteur réel n’a été créée ou modifiée pendant les vérifications.
