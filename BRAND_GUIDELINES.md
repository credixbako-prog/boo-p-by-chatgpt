# Identité visuelle BOO-P

Révision du 11 septembre 2026 · référence pour l’application et ses documents.

![Logo BOO-P](assets/brand/boo-p-horizontal.svg)

Le logo reprend le dessin retenu dans « Proposer de nouveaux logos » : **trois livres collés en perspective**, le premier ouvert avec une ombre intérieure, un marque-page ocre et une seule courbe sauge à droite. Les couvertures restent en aplats. Ne pas ajouter de quatrième livre, de trait transversal ni d’arc sous le symbole.

## Sources et déclinaisons

Les deux masters sont [le symbole SVG](assets/brand/boo-p-symbol.svg) et [le nom vectorisé](assets/brand/boo-p-wordmark.svg). Le nom utilise Poppins Bold, converti en tracés pour conserver son dessin sans charger de police. Sa licence est conservée dans [Poppins-OFL.txt](assets/brand/Poppins-OFL.txt).

| Fichier | Usage |
|---|---|
| [Horizontal couleur](assets/brand/boo-p-horizontal.svg) | Navigation, connexion, onboarding, carnet et impression |
| [Horizontal inversé](assets/brand/boo-p-horizontal-reverse.svg) | Pied de page, carnet sombre et rapport mensuel |
| [Vertical couleur](assets/brand/boo-p-vertical.svg) | Documents, présentation et communication |
| [Symbole seul](assets/brand/boo-p-symbol.svg) | Signature et composition d’icônes |
| [Symbole inversé](assets/brand/boo-p-symbol-reverse.svg) | Signature sur fond bleu nuit |
| [Monochrome](assets/brand/boo-p-monochrome.svg) | Dessin à une encre sur papier crème ; les pages restent crème |
| [Image de partage](assets/brand/boo-p-share.png) | Aperçu de lien, 1 200 × 630 px |
| [Icône carrée](assets/icons/boo-p-icon-1024.png) | Master 1 024 px, utilisable comme avatar de marque |

Les chemins historiques `boo-p-logo`, `boo-p-app-icon` et `boo-p-brand-board` pointent aussi sur cette identité. Le dossier `closed-book-proposals` conserve uniquement les propositions historiques ; l’application ne les utilise plus.

## Couleurs et composition

| Couleur | Valeur | Rôle |
|---|---|---|
| Bleu nuit | `#0F1B2D` | Deux premiers livres et nom |
| Sauge | `#6D8F7A` | Troisième livre et sentier |
| Ocre | `#D28B3D` | Marque-page |
| Crème | `#F2EDE3` | Pages et fond d’icône |

La version inversée échange le bleu et le crème et utilise une sauge plus claire (`#A9C2B2`). Elle conserve le même tracé. Les thèmes de lecture restent personnalisables indépendamment du logo.

Conserver les proportions et une marge libre autour du logo. Ne pas lui ajouter d’ombre, de cadre arrondi ni d’effet de relief dans les en-têtes. Les dimensions usuelles sont 150 × 45 px sur ordinateur, 120 × 36 px sur mobile, 200 × 60 px dans l’onboarding et 110 × 33 px dans le carnet. Le symbole n’est pas ajouté à la conversation immersive afin de préserver sa sobriété.

Les pictogrammes de fonctions (lecture, bibliothèque, scan, notifications) restent des boutons fonctionnels distincts du logo.

## Webapp installable et cache

Les icônes PNG de 192 et 512 px ont un fond opaque carré. L’icône Apple mesure 180 px. Le système applique son propre masque ; les coins ne sont pas dessinés dans les fichiers.

Une icône `maskable` de 512 px dispose de marges supplémentaires : le symbole entier reste dans le cercle central de sécurité de rayon 40 % du côté. Le favicon SVG et les PNG de 16/32 px conservent les trois livres ; aucune variante simplifiée à un livre n’a été validée.

Le manifeste versionne les icônes. Le service worker v48 renouvelle les ressources de l’application et met en cache les logos employés dans les pages et les exports. Le rafraîchissement d’une icône déjà installée dépend aussi du navigateur et du système ; une réinstallation peut être nécessaire.

## Régénération

`node tools/build-brand.cjs` régénère les déclinaisons SVG et PNG à partir des deux masters. Le script nécessite `sharp` ; `SHARP_MODULE` peut désigner une installation existante. Il ne télécharge aucune ressource. Modifier les masters puis régénérer les exports, sans retoucher chaque fichier séparément.

Le carnet imprimé attend le chargement du logo avant d’ouvrir l’impression (avec délai de secours). Le rapport mensuel charge les deux variantes locales et conserve le nom BOO-P en texte si l’image est indisponible. Les exports texte restent des fichiers texte.
