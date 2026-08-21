# BOO-P

BOO-P est un compagnon web de lecture : sessions, mémoire active, parcours personnel et communauté bienveillante.

Ce dépôt contient le prototype web installable du MVP, connecté à Supabase pour l’authentification, les Traces, les clubs, les photos privées et les notifications sociales en temps réel.

## Ouvrir l’application

La version publiée est disponible sur GitHub Pages :

https://credixbako-prog.github.io/boo-p-by-chatgpt/

## Développement local

Servez le dossier avec un serveur HTTP local puis ouvrez `index.html`. Les pages servies directement avec le protocole `file://` ne permettent pas l’installation de la webapp ni l’enregistrement du service worker.

## Phase actuelle

Prototype web interactif conforme au PRD v5.1 : bibliothèque et wishlist, livres papier/numériques/audio, sessions multiples avec un seul chronomètre, ajout par ISBN/photo/saisie manuelle, lexique avec dictionnaire et rappels J+1/J+3/J+5/J+30, badges privés et annuaire de lecteurs.

Tous les comptes authentifiés sont trouvables par nom ou pseudonyme. Un profil privé ne révèle que cet aperçu minimal jusqu’à l’acceptation de la demande d’amitié. Les demandes d’amis, réponses aux Traces et encouragements alimentent un centre de notifications privé et synchronisé. Les recommandations éditoriales, les données de démonstration et certaines fonctions communautaires restent explicitement simulées.
