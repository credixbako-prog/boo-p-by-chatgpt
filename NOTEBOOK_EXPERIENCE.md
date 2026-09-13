# BOO-P — carnet, écriture et profils

La version du 12 septembre 2026 a été publiée dans `06275e0`. Les évolutions du 13 septembre ci-dessous sont validées et leur publication est autorisée ; les migrations et les contrôles de droits en production passent. Voir [READING_EXPERIENCE_20260913.md](READING_EXPERIENCE_20260913.md).

## Carnet et pensées

- Les cartes de réflexion et de conversation ont des marges intérieures, un retour à la ligne et un filet vertical ocre.
- Les pensées disposent d’un aperçu limité à 240 px. Les citations ont leur propre onglet et réutilisent le style de citation publiée. « Voir plus » apparaît uniquement lorsque le contenu dépasse réellement cette hauteur ; il ouvre le texte complet.
- Modifier, Supprimer et Partager se trouvent sur la même rangée. Le livre associé devient un lien en cartouche bleu nuit, sans soulignement.
- Les pensées disposent d’un éditeur avec trois tailles (14, 16 et 20 px), gras, italique et souligné. Les commandes agissent sur la sélection ou sur la suite de la saisie. Le collage conserve le texte seul.
- Les brouillons de pensées retrouvent leur texte et leur mise en forme après fermeture/rechargement. La conservation locale existante reste limitée à 30 jours et aux dix derniers brouillons. Les pensées enregistrées suivent la synchronisation privée existante.

## Session

« Trace en brouillon » ouvre une page d’écriture en plein écran. Le texte et la mise en forme sont conservés dans la session active, puis transférés dans une pensée privée lors de l’enregistrement de la lecture. Le titre et l’auteur accompagnent un champ Sujet modifiable. Le bilan conserve cette pensée et propose une fiche de lecture à questions facultatives, modifiable ensuite dans Réflexions. Le bandeau « Sauvegarde locale active » est retiré.

La dictée se trouve dans l’éditeur. Elle utilise la reconnaissance vocale du navigateur lorsqu’elle est disponible ; elle peut dépendre du service distant fourni par ce navigateur. Aucune API OpenAI n’est appelée par cette dictée. Le microphone s’arrête à la fermeture de l’éditeur. Le clavier reste disponible lorsque la dictée est absente ou refusée.

## Cartes mensuelles

| Emplacement | Affichage |
| --- | --- |
| Sentier → Cartes et bilans | Grille verticale de cartes enregistrées puis création, avec les bilans annuels dans une section dédiée |
| Accueil | Balayage horizontal, création en dernière position ; les cartes enregistrées présentent seulement l’image, ouvrable pour le détail et la gestion |
| Profil personnel ou visité | Balayage horizontal des cartes publiées, sans création |

Les carrousels présentent une carte par page et des points cliquables : point plein pour la carte courante, points vides pour les autres. Ils conservent le chargement des cartes suivantes. Les flèches sont retirées.

## Profils, publications et notifications

La bio du profil personnel suit directement la visibilité du profil. Les trois indicateurs livres lus, temps de lecture et série se trouvent dans l’en-tête. Les trois badges les plus récents sont affichés automatiquement, avec accès discret à la collection complète. Les autres statistiques restent repliables.

Dans les profils visités, la vue Couvertures devient une mosaïque sans les anciens textes ni boutons sous chaque livre. Toucher une couverture ouvre sa fiche et permet toujours de l’ajouter à sa bibliothèque. Les lectures en cours conservent Encourager et Trace sur une seule rangée. L’option Meuble reste disponible.

Le fil conserve l’intégralité du contenu partagé et sa légende. L’affichage initial des longs textes est limité à 260 px ; Plus/Moins déplie le texte sur place. Un défaut de chargement supprimait `reading_content` du modèle du fil : il est maintenant conservé pour toutes les catégories. Les anciennes citations et les textes simples restent lisibles.

Un menu ••• regroupe les actions de publication dans le fil, les profils, les clubs et les cartes. Modifier est réservé à l’auteur ; Partager, Signaler et Supprimer suivent les droits décrits dans le document du 13 septembre. Les souvenirs utilisent le formulaire de copie publiée existant ; les publications générales peuvent modifier texte, livre, activité et visibilité. La photo existante est conservée. La politique serveur `community_posts_update_own` vérifie l’auteur dans `USING` et `WITH CHECK` ; le client filtre aussi par propriétaire et interrompt le parcours si le compte change. La migration du 13 septembre ajoute les signalements, les droits associés et les périodes annuelles.

Ouvrir une notification la marque immédiatement comme lue, puis synchronise cet état. Le bouton individuel « Marquer comme lue » est supprimé ; l’action globale reste disponible. Le texte du logo passe en blanc en thème sombre grâce à la variante inversée existante.

## Format et vérification

`thought-editor.js` conserve le texte brut et des segments autorisés dans `formatting: { version: 1, runs: [...] }`. Seuls gras, italique, souligné et les tailles prévues sont acceptés. Le rendu échappe le texte ; aucun HTML fourni par l’utilisateur n’est stocké ni exécuté. Un format incohérent avec le texte est ignoré. Les pensées publiées avec mise en forme utilisent l’enveloppe `boop-thought-v1` dans le champ `reading_content` existant. L’éditeur utilise les commandes natives pour conserver l’annulation ; les tests navigateur couvrent leur comportement dans Chrome.

Vérifications : 106 tests Node réussis ; parcours navigateur `notebook-experience-journeys`, `reading-journeys`, `reader-profile-journeys`, `reader-badges-journeys`, `cards-shelves-journeys`, `reading-sharing-journeys` et `ui-polish-journeys`. Couverture supplémentaire : texte sélectionné, annulation, paragraphes, collage de HTML en texte seul, validation des pensées vides, rechargement des brouillons et enregistrement du bilan, notification lue à l’ouverture, édition réservée à l’auteur, débordements et thème sombre.

Les essais utilisent des profils et publications fictifs isolés. La politique serveur existante a été consultée dans Supabase. Le clavier et le microphone réels de Safari sur iPhone restent à essayer sur appareil physique. Le cache de l’application passe à v55 et inclut le nouvel éditeur et sa feuille de style. Un essai avec le réseau coupé confirme que l’éditeur se charge et retrouve le brouillon après rechargement de la page.
