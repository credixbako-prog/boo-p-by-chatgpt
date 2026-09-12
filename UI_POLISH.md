# BOO-P — cadrages et commandes communes

Évolution publiée le 12 septembre 2026 dans le commit 977a681. Les nouveaux retours sur le carnet et les profils sont décrits dans [NOTEBOOK_EXPERIENCE.md](NOTEBOOK_EXPERIENCE.md).

## ISBN

Le choix Scanner ouvre désormais une caméra intégrée à BOO-P, dans l’ajout d’un livre et pendant la première ouverture. Un cadre horizontal de proportion 2,8:1 délimite la zone capturée. Le calcul tient compte du recadrage de la vidéo à l’écran, de ses dimensions réelles et de celles du cadre. L’analyse utilise cette zone ; l’aperçu ne présente plus une photo entière dont une autre zone serait analysée silencieusement.

L’import d’une photo reste accessible lorsque la caméra est absente ou refusée. Il propose un cadrage ISBN déplaçable avec zoom, rotation et réglages de position. Le fichier original n’est pas modifié. Les pistes vidéo sont arrêtées à la fermeture, au changement d’onglet ou lorsque la caméra est autorisée après la fermeture de sa fenêtre. La caméra n’utilise pas le microphone.

## Photos de publication

La photo passe par une fenêtre de cadrage avant son ajout : Original, Portrait 4:5, Carré ou Paysage 4:3. Le format original est présélectionné. Zoom, rotation, déplacement tactile/souris et réglages clavier permettent d’ajuster le contenu visible. Un aperçu de la photo résultante apparaît dans le formulaire, avec Recadrer et Retirer. Annuler un nouveau cadrage conserve le précédent.

L’image enregistrée est le résultat validé du cadrage, en JPEG, limité à 1 600 pixels sur son plus grand côté ; le travail de rotation utilise au maximum 2 560 pixels pour limiter la mémoire sur téléphone. La compression existante conserve ensuite ses proportions. Le fil affiche l’image selon ses dimensions naturelles et ne lui impose plus une découpe 16:9. Les photos déjà publiées retrouvent également leurs proportions enregistrées. Les illustrations de démonstration restent signalées comme fictives.

## Commandes et textes

- Les couleurs du meuble utilisent le bouton rond ◐ de l’accueil, également dans les profils visités.
- Bibliothèque, Lexique, Carnet, Sentier, notifications et parcours des profils utilisent le même volet discret Filtres. Les statuts de bibliothèque et les options de tri/affichage sont à l’intérieur ; la rangée de statuts extérieure est supprimée.
- L’accueil présente les cartes enregistrées avec le même carrousel que Carnet : création en première position, cartes suivantes à parcourir horizontalement.
- Les trois textes d’introduction signalés dans Communauté sont retirés. Les explications redondantes sont réduites ; les petits textes d’aide conservés portent la classe `ui-help`, en **6 px selon la demande explicite de l’utilisateur**. Cette taille ne s’applique pas au contenu publié, aux libellés de champs, aux boutons, aux erreurs ni aux indications de confidentialité.

## Implémentation et validation

`js/photo-frame.js` regroupe la géométrie, le cadrage et la caméra. `css/ui-polish.css` fournit les styles communs et les adaptations photo. Aucun nouveau service IA, accès payant, changement de schéma Supabase ou migration n’est nécessaire. Les appels de publication existants reçoivent simplement le fichier déjà cadré.

101 tests Node passent, dont les contrôles de géométrie pour différentes orientations et différents niveaux de zoom. Le parcours `tests/ui-polish-journeys.cjs` vérifie caméra simulée, capture, refus, autorisation tardive, import ISBN, formats photo, annulation, enregistrement invité et correspondance avec le fil, commandes de couleur, filtres et carrousel d’accueil, aux largeurs 320, 390 et 1 024 px. Le scanner de première ouverture est également exercé. Les parcours existants de lecture, cartes et profils passent.

Les captures sont conservées dans `.tmp/polish-review/`. Ces contrôles utilisent Chrome avec caméra et données fictives. La mise au point optique, la permission caméra dans une PWA iPhone et la lecture d’un code imprimé doivent encore être essayées sur un téléphone physique.
