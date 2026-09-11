# BOO-P

BOO-P est un compagnon web de lecture : sessions, mémoire active, parcours personnel et communauté bienveillante.

Ce dépôt contient le prototype web installable du MVP, connecté à Supabase pour l’authentification, les Traces, les clubs, les photos privées et les notifications sociales en temps réel.

## Ouvrir l’application

La version publiée est disponible sur GitHub Pages :

https://credixbako-prog.github.io/boo-p-by-chatgpt/

## Identité visuelle — 11 septembre 2026

Le logo à trois livres en perspective est décliné dans la navigation, l’onboarding, le carnet, les exports, les aperçus de partage et les icônes installables. Les masters SVG, couleurs, usages et instructions de régénération sont réunis dans le [guide d’identité visuelle](BRAND_GUIDELINES.md).

## Partages entre lecteurs — 11 septembre 2026

Les amis acceptés peuvent consulter leurs bibliothèques. Carnets, mots, expressions, citations, pensées et étapes de lecture disposent d’un partage volontaire : message et contenu modifiables, aperçu, audience amis ou publique, mise à jour et retrait. Les originaux personnels et conversations IA restent privés. Le [guide des partages](READING_SHARING.md) détaille les accès et les vérifications.

## Développement local

Servez le dossier avec un serveur HTTP local puis ouvrez `index.html`. Les pages servies directement avec le protocole `file://` ne permettent pas l’installation de la webapp ni l’enregistrement du service worker.

## Phase actuelle

Prototype web interactif, expérience de lecture v5.7 : bibliothèque et wishlist, livres papier/numériques/audio, sessions multiples avec un seul chronomètre, ajout par ISBN/photo/saisie manuelle, lexique avec dictionnaire et rappels J+1/J+3/J+5/J+30, badges privés et annuaire de lecteurs.

Tous les comptes authentifiés sont trouvables par nom ou pseudonyme. Un profil privé ne révèle que cet aperçu minimal jusqu’à l’acceptation de la demande d’amitié. Les demandes d’amis, réponses aux Traces et encouragements alimentent un centre de notifications privé et synchronisé. Les recommandations éditoriales, les données de démonstration et certaines fonctions communautaires restent explicitement simulées.

## Mise à jour de l’expérience de lecture — 9 septembre 2026

Accueil centré sur le livre en cours ; bibliothèque en grille, liste ou étagère ; ajout par titre/auteur, ISBN ou saisie manuelle ; progression numérique ; chronomètre en pause pendant le bilan ; Carnet commun aux pensées, citations et mots ; brouillons locaux ; Sentier agrandi et chronologique ; accès direct aux réglages. Les préférences d’affichage déjà choisies sont conservées.

Les brouillons non envoyés restent sur l’appareil, séparés par compte, avec un maximum de dix et une expiration de trente jours vérifiée à l’usage. Ils sont exclus de la synchronisation et supprimés par l’effacement local.

## Vérifier les changements

`node --test tests/*.test.mjs` exécute les tests de données, de synchronisation et de structure. Ils sont aussi exécutés avant chaque publication GitHub Pages.

`node tests/reading-journeys.cjs` vérifie les parcours dans Chrome avec Playwright installé. Démarrer d’abord un serveur local ; `BOOP_TEST_URL` permet de choisir son adresse (défaut : `http://127.0.0.1:8766`). `PLAYWRIGHT_MODULE` et `CHROME_PATH` permettent d’utiliser des runtimes déjà installés. Le test utilise uniquement des données invitées et des réponses de catalogue simulées pour sa vérification déterministe. Les captures sont écrites dans `.tmp/ux-updated/`.
