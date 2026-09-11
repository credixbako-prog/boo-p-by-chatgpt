# BOO-P — préparation des notifications Firebase

Date : 11 septembre 2026.

## Périmètre validé

Préparer Firebase Cloud Messaging (FCM) pour les notifications push. L’authentification, les comptes, les données et les fonctions IA restent sur leur architecture actuelle. Aucune migration vers Firebase Authentication n’est engagée.

Le branchement web est implémenté : Profil → Compte et préférences → Préférences de notifications → Sur cet appareil. Le lecteur active explicitement les alertes, peut envoyer un test et les désactiver. Firebase Authentication n’est pas utilisé.

## Configuration créée et vérifiée

- Projet : **BOO-P**, identifiant `boo-p-a4461`.
- Numéro du projet / identifiant d’expéditeur : `954193229244`.
- Forfait : **Spark**, affiché sans frais (0 $/mois) dans la console.
- Application web : **BOO-P Web**, identifiant `1:954193229244:web:4a657fe9a66dd79fa9a7b9`.
- API Firebase Cloud Messaging V1 : **activée** ; ancienne API : désactivée.
- Certificat Web Push / VAPID : paire générée le 11 septembre 2026, confirmation visible dans la console. La clé privée n’a pas été consultée ni exportée.
- Google Analytics et Gemini : options désactivées lors de la création.
- Firebase Hosting : non sélectionné. L’application reste hébergée sur GitHub Pages.
- Le SDK Firebase web **12.2.1** est chargé à la demande pour Messaging uniquement. Cette version utilise les API de jetons `getToken` / `deleteToken`, avec l’inscription du service worker existant. Aucune API d’identifiants d’installation de la nouvelle interface n’est mélangée à ce flux.
- Fonction Supabase `push-notifications` déployée avec authentification applicative : validation de session via Supabase Auth pour les lecteurs ; capacité aléatoire à usage unique pour chaque tâche créée par le déclencheur SQL.
- Le secret `FIREBASE_SERVICE_ACCOUNT` a été ajouté par l’exploitant dans Supabase. La clé n’est ni dans le dépôt ni dans le navigateur. L’échange OAuth Google a été vérifié avec succès depuis le serveur.

[Console du projet](https://console.firebase.google.com/project/boo-p-a4461/overview)

Les paramètres publics du SDK web sont consultables dans Paramètres du projet → Paramètres généraux → BOO-P Web et dans `js/push-notifications.js`. Ils ne constituent pas des identifiants d’administration.

Clé **publique** VAPID préparée pour l’intégration :

```text
BPCqo0FJfM9gO08jXADyty8qWMKNisrSZYIaj3zl63NvIAcO01s1kUZCv-MlkyViO1BFjrQuaqvcNuWH1mXHcpk
```

## Architecture du branchement

- Conserver Supabase comme source des notifications internes et des préférences du lecteur.
- Associer chaque inscription push à l’utilisateur connecté, côté serveur, sans accepter un identifiant de destinataire arbitraire fourni par le navigateur.
- Demander l’autorisation de notification uniquement après une action explicite du lecteur. Prévoir la désactivation, la déconnexion et le changement de compte sur un même appareil.
- Utiliser FCM pour la livraison et un serveur de confiance pour les envois. Ne jamais placer de clé privée de compte de service dans le JavaScript public, Git ou le cache PWA.
- Envoyer par défaut un contenu discret, sans extrait du carnet personnel visible sur l’écran verrouillé.
- Commencer par un test limité au compte de test et à son appareil, avant les rappels automatiques.

## Particularités de l’application actuelle

L’application est hébergée sous `/boo-p-by-chatgpt/` sur GitHub Pages. `js/pwa.js` enregistre déjà `service-worker.js` avec la portée `./`. Le branchement FCM devra respecter cette portée et réutiliser cette inscription lorsque l’API choisie le permet, sans remplacer involontairement le fonctionnement hors connexion.

Les notifications actuellement affichées par `js/notifications-api.js` viennent de Supabase. Elles ne constituent pas encore une inscription aux notifications push du navigateur.

## Vérification et fonctionnement

- 86 tests automatisés passent, dont 10 nouveaux tests de sécurité, filtrage, livraison, révocation et traitement du clic.
- Vérification navigateur isolé : invité bloqué, activation, vraie exécution du service worker sur un événement push simulé, désactivation et fermeture des alertes, erreur serveur explicite. Les appels FCM du navigateur et la session ont été simulés ; aucun compte utilisateur n’a été connecté dans ce test.
- Vérification distante : échange OAuth avec la clé réelle réussi ; déclencheur SQL → pg_net → fonction d’envoi vérifié par une tâche filtrée, HTTP 200, sans envoi sur appareil.
- Une réception réelle sur le téléphone du lecteur reste à vérifier avec le bouton **Tester** après publication et autorisation du navigateur.
- Les tables `push_devices` et `push_jobs` ont RLS activé et aucun droit pour `anon` / `authenticated`. Leur accès passe exclusivement par la fonction serveur. Le signalement informatif « RLS Enabled No Policy » est volontaire : refus par défaut des accès clients.
- Les événements sociaux déjà créés dans `notifications` alimentent le déclencheur ; les anciens événements ne sont pas rejoués. Les rappels horaires de lecture / objectifs ne sont pas programmés par cette intégration.
- Les filtres d’amitiés, traces et encouragements sont appliqués côté serveur. Le texte des alertes reste générique.
- Un test par minute et par appareil, au plus 20 appareils par compte. Une inscription devient inéligible après 60 jours sans actualisation. Les jetons signalés expirés par FCM sont supprimés.
- Les tâches échouées sont marquées `failed` ; cette première version ne les relance pas automatiquement pour éviter les doublons. Les tâches de plus de 7 jours sont nettoyées lors de l’ajout d’une nouvelle tâche ; les inscriptions anciennes d’un compte sont nettoyées lors de son prochain enregistrement d’appareil. Suppression du compte : suppression en cascade des inscriptions et notifications associées.
- Déconnexion : désactivation locale en premier, fermeture des notifications affichées, révocation de l’abonnement navigateur, puis suppression serveur lorsque la connexion le permet.

## Vérifications à poursuivre sur les appareils ciblés

- Vérifier les API FCM et la version du SDK retenues au moment de l’intégration. La documentation actuelle distingue les identifiants d’installation Firebase des anciennes API de jetons ; ne pas mélanger leurs mécanismes d’inscription.
- Vérifier la compatibilité navigateur, le refus d’autorisation et les conditions d’installation sur iPhone/iPad.
- Tester réception au premier plan, en arrière-plan, clic vers la bonne page et absence de doublons.
- Tester la séparation des comptes, la révocation d’une inscription et le nettoyage des inscriptions devenues invalides.
- Adapter les informations de confidentialité aux données effectivement transmises avant d’ouvrir le service aux lecteurs.

## Documentation de référence

- [Configurer FCM pour le web](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Architecture FCM](https://firebase.google.com/docs/cloud-messaging)
- [Tarification Firebase](https://firebase.google.com/pricing)

FCM est annoncé sans frais. D’éventuels traitements serveur associés ont leurs propres quotas et tarifs.
