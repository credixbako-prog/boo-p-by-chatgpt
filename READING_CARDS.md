# BOO-P — cartes conservées, citations et rangement

Évolution du 11 septembre 2026. Migration des cartes appliquée après autorisation explicite ; tests locaux et droits serveur vérifiés. Interface autorisée pour publication sur GitHub main.

## Cartes de lecture

Bibliothèque → Carnet distingue **Réflexions** et **Cartes de lecture**. Dans le carnet, une grille à défilement vertical commence par « Créer ma carte du mois », puis présente les cartes enregistrées. Sur l’accueil et les profils, les cartes restent en carrousel horizontal, avec des points de pagination pleins/vides à la place des flèches. L’accueil affiche seulement l’image des cartes enregistrées ; elle ouvre leur détail et les actions de gestion. Après génération, « Enregistrer dans mon carnet » conserve la carte ; le téléchargement et le partage natif existants restent disponibles.

Une carte enregistrée est une image JPEG figée, accompagnée du mois, d’un titre et d’une légende. Le JSON source du bilan, les notes et les conversations IA ne sont pas joints. L’utilisateur doit vérifier les informations visibles dans l’image avant de la partager. Le téléchargement direct du générateur reste en PNG ; une carte conservée se télécharge en JPEG.

Les cartes sont privées à leur création. Une action explicite permet de choisir **Mes amis**, **La communauté** ou **Moi uniquement** pour retirer une publication. La légende est modifiable. Les cartes publiées apparaissent sur le profil personnel et dans le parcours du profil visité, sans tuile de création. Elles ne créent pas automatiquement de publication dans le fil communautaire. « La communauté » désigne ici les utilisateurs connectés.

L’image est conservée d’abord dans IndexedDB (`boop-reading-cards-v1`), dans un espace propre au compte ou à l’invité, puis synchronisée avec Supabase. Une erreur réseau conserve la copie locale privée et permet une nouvelle tentative. Les pages distantes contiennent six cartes. Le chargement du carnet et le retour en ligne permettent de retenter la synchronisation ; il n’y a pas de synchronisation en arrière-plan lorsque l’application est fermée. Les dialogues et vues sont vidés au changement de compte. L’export local inclut les cartes présentes sur l’appareil ; l’effacement du compte efface leur cache local et supprime les lignes distantes par cascade.

## Droits et mise en service

Migration **appliquée et vérifiée** : `supabase/migrations/20260911204712_reading_cards.sql`.

La table `reading_cards` stocke une image JPEG encodée, limitée à 2,2 millions de caractères, et ses métadonnées. RLS réserve l’insertion au propriétaire avec une visibilité privée. Seules la légende et la visibilité sont modifiables après insertion. La lecture est autorisée au propriétaire, aux amis acceptés pour une carte destinée aux amis, ou aux comptes connectés pour une carte communautaire. Aucun accès anonyme n’est accordé.

`tests/reading-cards-access.sql` a exécuté une vérification transactionnelle avec comptes fictifs et annulation : carte privée, usurpation, insertion publique interdite, image immuable, amis, étrangers, publication, retrait et accès anonyme. **Le test SQL passe après migration, avec annulation des données fictives.** Il complète les parcours locaux avec API simulée. Les conseillers de sécurité ne signalent rien de nouveau : quatre tables techniques restent fermées sans politique client ; l’avertissement préexistant de [protection des mots de passe compromis](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) est inchangé.

## Citations et légendes

Dans « Préparer ma publication », la citation vient en premier, en italique avec de grands guillemets et son attribution. Le texte personnel est une légende plus discrète sous la citation. Cette hiérarchie est reprise dans l’aperçu, le fil et le détail d’une publication, y compris sur les profils.

Les nouvelles citations utilisent une enveloppe JSON `boop-citation-v1` dans le champ texte existant `reading_content`, avec citation et attribution séparées. Les anciens contenus restent lisibles tels quels ; aucune attribution n’est inventée. Tous les champs sont échappés avant affichage.

**Feuille de route, à définir ultérieurement :** les offres payantes pourront personnaliser les cartes de citations avec l’IA. Le périmètre, les modèles, les coûts, les limites d’usage et les tarifs restent à préciser. Cette version n’ajoute ni personnalisation IA, ni appels facturés, ni mécanisme d’abonnement pour ces cartes.

## Autres ajustements d’interface

- Communauté regroupe clubs et salons dans **Clubs & salons**, en conservant leurs fonctions.
- Les profils présentent le nom ou pseudonyme sans afficher l’identifiant secondaire.
- Les médaillons des badges ont un fond bleu nuit ; les illustrations et animations existantes sont conservées.
- Sous la couverture d’une lecture en cours, un petit bouton à pictogramme ouvre les actions de mise à jour de page et d’ajout d’une session passée.
- Un appui long sur une tranche de livre permet de la déplacer vers un autre rayon. Le livre se soulève visuellement, le rayon cible est mis en évidence et un rayon replié s’ouvre après survol prolongé. Échap ou l’annulation du geste abandonne le déplacement. La fiche du livre permet aussi de choisir un rayon existant ou d’en créer un ; casse, accents et espaces sont normalisés pour réutiliser le libellé existant.

## Vérifications locales

99 tests Node passent. Le parcours `tests/cards-shelves-journeys.cjs` vérifie l’enregistrement et le rechargement local, plusieurs cartes, le carrousel, la publication et son retrait avec API simulée, l’échec réseau sans perte de légende, le profil, les menus de lecture, le rangement à la souris et par événements tactiles Chrome, les rayons normalisés, les citations, l’export et l’isolation des comptes.

Les parcours existants de lecture, de partage, de profils et de badges passent également. Les captures de contrôle sont dans `.tmp/cards-review/`. Le geste de rangement doit encore être essayé sur un iPhone physique ; l’émulation tactile Chrome ne vérifie pas Safari iOS.

Évolution préparée le 12 septembre : le carrousel des cartes rejoint aussi la dernière section de l’accueil, avec création en première position. Voir [UI_POLISH.md](UI_POLISH.md).


Évolution du 12 septembre 2026 : voir [NOTEBOOK_EXPERIENCE.md](NOTEBOOK_EXPERIENCE.md) pour les dispositions par écran et les nouvelles vérifications.
