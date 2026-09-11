# Profils de lecture et échanges — 11 septembre 2026

Le profil visité devient un espace de lecture, organisé en **Son parcours**, **Bibliothèque** et **Carnets**. L’identité, la biographie et les centres d’intérêt existants sont conservés. Le propriétaire peut ajouter une phrase d’accueil de 180 caractères, masquer la section des lectures en cours et choisir jusqu’à six livres à mettre en avant depuis **Profil → Mon espace de lecteur**. **Voir mon profil de lecture** ouvre sa présentation et les échanges reçus ; la page reste vue avec les droits du propriétaire.

## Parcours et bibliothèque

- **Son parcours** : phrase d’accueil, repères sans classement, jusqu’à six lectures en cours, sélection de livres et publications accessibles avec filtre discret par type.
- **Bibliothèque** : meuble affiché par défaut, avec les mêmes finitions que la bibliothèque personnelle, livres sur la tranche, rayons repliables par statut et défilement horizontal. Une première touche sélectionne le livre ; une seconde ouvre sa fiche partagée. Les pages suivantes complètent le même meuble. Les filtres Tous, En cours, Lus et À lire et la pagination de 24 livres restent disponibles. « Affichage de la bibliothèque » propose aussi les couvertures et les six couleurs du meuble ; ces choix de consultation ne modifient pas les préférences de l’ami.
- **Carnets** : publications de carnets avec miniature, introduction choisie et lecture intégrale. Les échanges IA et notes privées ne sont jamais repris.
- **Fiche d’un livre visité** : détails bibliographiques limités, échanges et publications de début/fin/carnet directement associées à son identifiant. Les mots et pensées restent dans le parcours ; ils ne sont pas rattachés à cette fiche par une simple ressemblance de titre.
- **Ajouter à ma bibliothèque** : confirmation avec choix Bibliothèque/À lire ou liste d’envies. Seules les métadonnées partagées sont copiées, sans notes, progression ni état terminé du lecteur source. Les doublons sont détectés par ISBN ou titre.

Seules les couvertures de catalogue autorisées (Open Library et domaines Google Books explicitement listés) sont exposées. Les couvertures personnalisées et les autres URL restent privées ; un livre dessiné avec son titre les remplace. Masquer la section « En ce moment » ne retire pas les livres de la bibliothèque accessible aux amis ; cette distinction est indiquée dans les réglages.

## Encouragements et Traces

Les boutons **Encourager** et **Trace** sont alignés sur une même ligne dans les profils, fiches partagées et publications, avec le même style dans le fil communauté : cœur dessiné et bulle avec un crayon, contours arrondis, couleurs BOO-P et compteurs. Les états actif et déplié sont indiqués visuellement et par les attributs d’accessibilité. Trace ouvre la conversation sous cette rangée. Un encouragement par personne et par livre peut être retiré. Les Traces sont liées à leur livre ou publication, peuvent recevoir des réponses et sont affichées par pages de 50.

L’audience est indiquée avant envoi. Pour un livre de la bibliothèque, ce sont le propriétaire et ses amis acceptés ; pour une publication, les échanges suivent son audience. Le propriétaire peut supprimer les Traces reçues, et chaque auteur peut supprimer les siennes. La confirmation précise que les réponses sont supprimées également. Une erreur réseau conserve le texte du formulaire ouvert ; il ne s’agit pas d’un brouillon persistant après fermeture.

Les nouvelles interactions sur un livre alimentent les notifications existantes de type Trace/Encouragement. Les réponses préviennent aussi l’auteur de la Trace précédente s’il a encore accès. Un délai d’une minute limite les notifications répétées du même acteur, type et profil ; l’échange lui-même reste enregistré. Les alertes ne reprennent ni le texte de la Trace ni le titre du livre. Les préférences de notifications et le consentement push existants restent applicables.

## Données et droits

Migration appliquée : `20260911185935_reader_profile_experience.sql`.

- `reader_preferences` conserve la présentation facultative ; écriture réservée au propriétaire, lecture selon le profil ou l’amitié.
- `reader_book_interactions` conserve Traces, réponses et encouragements. RLS vérifie une amitié acceptée ou la propriété, et l’existence du livre dans la bibliothèque. Une demande en attente, la liste d’envies et un retrait d’amitié ne donnent aucun accès. Les invités ne peuvent pas interagir.
- Les réponses doivent appartenir au même propriétaire/livre grâce à une clé étrangère composite. Les interactions disparaissent avec la suppression du livre ou du compte ; déplacer un livre dans la liste d’envies les rend inaccessibles jusqu’à son éventuel retour dans la bibliothèque.
- `get_reader_profile_books` utilise une projection limitée et une fonction privée avec contrôle explicite de l’appelant ; le JSON personnel reste fermé.
- Une politique supplémentaire autorise le propriétaire d’une publication à supprimer les commentaires reçus.

Le blocage existant reste un masquage local. Le retrait d’amitié révoque réellement les accès entre amis. Les publications publiques restent publiques. Les données déjà consultées ne peuvent pas être effacées chez leur destinataire à distance.

## Vérifications

93 tests Node réussis, dont les nouveaux contrôles de changement de compte, d’accès invité et de longueur des Traces. Les parcours Playwright isolés vérifient le profil sur mobile/ordinateur, encouragements, Traces, réponses, erreur réseau, ajout de livre, rayons, carnet publié, préférences et révocation. La suite de partage précédente passe également. Aucun message n’a été envoyé à un compte réel pendant ces tests.

`tests/reader-profile-access.sql` a été exécuté après migration avec annulation transactionnelle : projection sûre, couverture personnelle exclue, préférences, accès amis/étranger, unicité des encouragements, réponses entre livres interdites, modération, notifications et révocation. Les avis de sécurité Supabase ne signalent rien de nouveau ; l’avertissement préexistant de [protection des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) reste distinct de cette évolution.

Les échanges avec deux comptes réels sur deux appareils, et la réception push correspondante, restent à essayer après publication de l’interface.
