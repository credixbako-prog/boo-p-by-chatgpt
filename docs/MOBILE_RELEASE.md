# BOO-P — préparation Google Play et App Store

État au 17 septembre 2026 : préparation technique en cours. Ce document ne certifie pas que l'application est prête à être soumise. Aucun compte développeur, achat, signature de production ou dépôt sur un store n'est effectué par cette préparation.

Les projets Android et iOS sont générés avec **Capacitor 8.5.2**, version `0.1.0`, build `1`, identifiant **provisoire** `fr.boop.app`. Confirmer l'identifiant avant l'enregistrement dans les consoles et la signature. L'utilisateur a confirmé une publication **en nom personnel**, aucun compte développeur existant et un poste **Windows sans Mac**. Les outils Android restent à installer.

Limites actuelles :

- Les e-mails de confirmation et de réinitialisation utilisent le parcours web public existant ; il faut revenir manuellement dans l'application. Le retour automatique par lien vérifié reste à intégrer et tester.
- Le push natif n'est pas implémenté. Les exports de données et fichiers restent à tester sur appareils.
- Les adaptations CORS de six fonctions Supabase sont préparées, mais **pas encore déployées**. Elles doivent être déployées puis vérifiées avant les tests des fonctions concernées depuis les origines natives.
- Le workflow `.github/workflows/mobile-preview.yml` prévoit une compilation d'APK Android de débogage et une compilation iOS pour simulateur sans signature de distribution. Il **n'a pas encore été exécuté** ; aucun résultat de compilation native n'est acquis.
- Le premier audit npm relève **trois alertes modérées dans les outils de développement**, via la CLI et ses dépendances `xcode` / `uuid`. Le contrôle distinct des dépendances de production reste à confirmer ; aucune absence de vulnérabilité en production n'est encore certifiée.

## 1. Comptes et outils à débloquer

| Sujet | Action nécessaire |
| --- | --- |
| Éditeur | Publication en nom personnel confirmée. Renseigner l'identité légale réelle lors de l'inscription ; le nom de marque BOO-P ne la remplace pas. |
| Google Play | Compte vérifié, frais uniques de **25 USD** ; un nouveau compte personnel doit aussi vérifier l'accès à un appareil Android. [Inscription Google](https://support.google.com/googleplay/android-developer/answer/6112435?hl=fr) |
| Identité Google | Pour le compte personnel prévu, Google rend publics le nom légal, le pays et l'adresse e-mail développeur. La monétisation ou certains territoires peuvent ajouter des coordonnées publiques. [Identité publique](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en) |
| Apple Developer | Créer un compte individuel : **99 USD/an**, montant local indiqué à l'inscription. Le nom légal de la personne apparaît comme vendeur. [Inscription Apple](https://developer.apple.com/programs/enroll/) |
| Distribution UE | Déclarer le statut professionnel (« trader ») dans App Store Connect. Pour les professionnels, Apple vérifie et publie adresse, téléphone et e-mail. Ce statut reste à déterminer par l'éditeur. [Exigences Apple UE](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements) |
| Android | Node 22+, Android Studio **2025.2.1+**, SDK Android et JDK fourni par Android Studio. Pour les soumissions actuelles, cibler **Android 16 / API 36**. [Environnement Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [Exigence Play](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en-AU) |
| iOS | Accès à macOS, local ou service de compilation Mac, avec **Xcode 26+ et SDK iOS 26+**. Les sources peuvent être préparées sous Windows, la compilation iOS nécessite macOS. [Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup), [Exigence Apple](https://developer.apple.com/news/upcoming-requirements/) |

## 2. Vérifications produit avant soumission

- [ ] Installer et tester le paquet mobile réel : inscription, confirmation par e-mail, connexion, mot de passe oublié, retour des liens d'authentification dans l'application, persistance de session et déconnexion.
- [ ] Vérifier les lectures, notes, clubs et publications ; tester clavier, bouton retour Android, zones de sécurité iPhone, liens externes, permissions micro/photo, perte de réseau et reprise de l'application. Une simple vérification du site dans Chrome ne valide pas le paquet natif.
- [ ] Vérifier l'expérience propre à une application et sa valeur fonctionnelle ; l'enveloppe Capacitor seule ne garantit pas l'acceptation Apple. [Règle Apple 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality)
- [ ] Revalider les signalements de contenus et de comptes, le blocage, les outils de modération et leur traitement effectif. Faire accepter les conditions avant publication ; compléter le filtrage des contenus inappropriés et les coordonnées de support. [Apple 1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content), [Google UGC](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en-GB)
- [ ] Tester la suppression complète du compte et des données associées, y compris les médias. Conserver une entrée visible dans l'application et une ressource web permettant de demander la suppression sans installer l'application. [Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app), [Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [ ] Inventorier les données réellement traitées par Supabase, l'IA, l'audio et les autres services ; finaliser la politique de confidentialité et les déclarations **Data safety** / **App Privacy** à partir de cet inventaire. Ne pas déclarer « aucune donnée collectée » par défaut. [Google](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en-GB), [Apple](https://developer.apple.com/app-store/app-privacy-details/)
- [ ] Avant un envoi de données personnelles à une IA tierce, présenter le destinataire et l'utilisation puis recueillir un accord explicite. Pour les fonctions génératives concernées, permettre de signaler une réponse problématique dans l'application et traiter ces signalements. [Apple 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing), [Google IA](https://support.google.com/googleplay/android-developer/answer/13985936?hl=en-GB)
- [ ] Définir honnêtement le public visé et remplir les questionnaires d'âge. Si la catégorie choisie est « Social », les normes Google de protection de l'enfance s'appliquent même à une application réservée aux adultes : règles publiques, mécanisme de signalement, procédure et contact responsables. [Google](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en)
- [ ] Examiner les permissions, dépendances et manifestes de confidentialité du projet iOS généré ; déclarer uniquement les usages réels. [App Privacy](https://developer.apple.com/app-store/app-privacy-details/)

Les éléments déjà livrés sur le web (administration, modération, suppression de compte) constituent une base ; les cases restent ouvertes tant que le parcours correspondant n'a pas été vérifié dans les versions mobiles.

## 3. Construire, tester, signer puis soumettre

Depuis la racine du projet :

```sh
npm ci
npm run build:mobile
npm run mobile:sync
npm run mobile:android
```

`mobile:sync` reconstruit les ressources avant synchronisation. `mobile:android` nécessite Android Studio ; **sur un Mac**, utiliser `npm run mobile:ios` pour ouvrir Xcode. Les projets natifs existent déjà : ne pas relancer `cap add` pour cette préparation. [Android](https://capacitorjs.com/docs/android), [iOS](https://capacitorjs.com/docs/ios)

1. Exécuter le workflow de prévisualisation et examiner ses résultats. Son APK de débogage sert aux essais ; sa compilation iOS pour simulateur ne fournit ni application installable sur iPhone ni version TestFlight. Un accès à une machine macOS et un parcours de signature seront encore nécessaires pour iOS.
2. Déployer les adaptations CORS préparées, puis tester sur téléphones réels avec des comptes de test et des données fictives. Documenter les versions, appareils, résultats et incidents restant à résoudre. Les tests navigateur et la compilation CI ne remplacent pas ces essais.
3. Pour Android, créer et sauvegarder la clé d'envoi hors du dépôt, générer un **Android App Bundle signé (`.aab`)**, puis configurer **Play App Signing**. Commencer par la piste interne. [Signature Google](https://developer.android.com/studio/publish/app-signing), [Envoi du bundle](https://developer.android.com/studio/publish/upload-bundle)
4. Le nouveau compte Google personnel prévu impose un **test fermé avec au moins 12 testeurs inscrits sans interruption pendant 14 jours**, puis une demande d'accès à la production. Ce délai n'accorde pas automatiquement la publication. [Règle Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB)
5. Pour iOS, associer la bonne équipe Apple et le Bundle ID, configurer signature et capacités, archiver la version, puis l'envoyer dans App Store Connect pour TestFlight avant la soumission. Garder certificats, clés et accès de signature hors du dépôt.
6. Préparer description, catégorie, icône, captures du produit réel et notes de version. Google demande au moins deux captures et un visuel de présentation **1024 × 500** ; Apple demande une à dix captures aux dimensions adaptées aux appareils pris en charge. [Visuels Google](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en-GB), [Captures Apple](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
7. Fournir aux équipes de revue un compte de démonstration actif, des données fictives représentatives et des instructions précises pour les fonctions peu visibles. Maintenir le serveur accessible ; ne pas transmettre le compte administrateur `contact@boo-p.fr` ni mettre de mots de passe dans Git. [Google](https://support.google.com/googleplay/android-developer/answer/10788890?hl=en), [Apple](https://developer.apple.com/app-store/review/guidelines/#app-completeness)

## 4. Contrat avec la tâche Hostinger

Le site public et les paquets mobiles peuvent avancer séparément. La tâche Hostinger devra fournir des URL HTTPS stables, accessibles sans compte :

| Chemin proposé, à confirmer | Contenu attendu |
| --- | --- |
| `https://boo-p.fr/support` | Présentation du support BOO-P et contact `contact@boo-p.fr`. |
| `https://boo-p.fr/confidentialite` | Politique finalisée avec l'identité réelle de l'éditeur, données, finalités, services destinataires, conservation et droits. Le présent document ne remplace pas cette politique. |
| `https://boo-p.fr/suppression-compte` | Moyen utilisable de demander la suppression du compte et des données ; description des données effacées, des éventuelles rétentions justifiées et des délais réels. Une simple page invitant à réinstaller l'application ne suffit pas. |
| Conditions d'utilisation | Règles de participation et de modération, accessibles depuis l'application ; adresse finale à convenir. |

Pour les futurs liens vérifiés ouvrant l'application, réserver la possibilité de servir `/.well-known/assetlinks.json` (Android App Links) et `/.well-known/apple-app-site-association` (Apple Universal Links). Leur contenu dépend des identifiants définitifs, du Team ID Apple et de l'empreinte du certificat de signature de l'application Android. Les publier uniquement une fois ces valeurs confirmées, puis coordonner les chemins de retour d'authentification. [Liens Capacitor](https://capacitorjs.com/docs/guides/deep-links)

Cette préparation ne modifie ni Hostinger, ni le DNS, ni les redirections Supabase. Les URL proposées ci-dessus ne sont pas annoncées comme déjà publiées.
