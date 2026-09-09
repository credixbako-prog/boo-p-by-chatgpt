# Test vocal OpenAI dans BOO-P

Pour le test combinant texte, dictée, voix et carnet, consulter désormais OPENAI_TEST_SETUP.md. L’autorisation administrateur `app_metadata.boop_ai_test = true` permet aussi l’accès vocal. La transcription peut maintenant être sauvegardée explicitement dans le carnet depuis le bouton dédié après l’arrêt.

Le prototype utilise OpenAI Realtime (`gpt-realtime-2.1`, voix `marin`) via WebRTC. Aucun entraînement de modèle. ChatGPT Pro et la facturation API sont séparés. Aucune clé n'est fournie avec le code ; aucun appel payant n'est possible sans activation.

## Activation par le responsable

1. Consulter https://platform.openai.com/settings/organization/billing/overview avec son compte OpenAI. Vérifier les crédits éventuels et l'accès au modèle. Si nécessaire, acheter soi-même les crédits API (minimum affiché actuellement : 5 USD), en désactivant la recharge automatique si souhaité. Un solde prépayé ne garantit pas une coupure instantanée des dépenses.
2. Créer un projet OpenAI dédié « BOO-P test » et une clé de projet. Ne pas la mettre dans GitHub, dans le navigateur BOO-P, dans une conversation ou dans un fichier public.
3. Dans les secrets Edge Functions du projet Supabase BOO-P (`shnyjvinzjvgourpscvh`), enregistrer `OPENAI_API_KEY` et `BOOP_VOICE_TESTER_IDS` (UUID des comptes adultes expressément autorisés, séparés par des virgules). Relever ces UUID dans Authentication > Users. Une liste vide bloque tous les utilisateurs. Le responsable doit vérifier que les testeurs autorisés sont majeurs ; la case de confirmation n'est pas une vérification d'âge.
4. Appliquer `supabase/migrations/20260909163000_reading_voice_test.sql`, puis déployer `reading-voice` avec `index.ts` et `core.mjs`. La vérification JWT de passerelle peut être désactivée : le corps de la fonction vérifie chaque token via Supabase Auth avant toute opération, puis applique la liste privée des testeurs. Ne pas retirer cette authentification.
5. Publier les fichiers publics. Se connecter au compte testeur, ouvrir un livre, puis « Parler de ce livre · test IA ». Confirmer le test et autoriser le micro. Tester d'abord une minute, terminer, télécharger les mesures et vérifier la consommation dans OpenAI avant un essai plus long.

## Mesure et limites

Les événements `response.done` sont dédupliqués. Le rapport distingue entrée/sortie audio et texte, ainsi que les entrées en cache. Les événements de transcription sont conservés séparément. Les compteurs absents restent inconnus : aucune valeur manquante n'est assimilée à zéro. Les événements reçus par le navigateur ne sont pas un registre de facturation de confiance et peuvent être incomplets après une coupure. L'estimation monétaire couvre les réponses Realtime, hors transcription, taxes et éventuels frais supplémentaires. Vérifier la facture et les tarifs OpenAI.

Le serveur réserve atomiquement au plus trois créations de session par compte et six au total par jour UTC, erreurs incluses. Une seule session récente est autorisée par compte. Le navigateur coupe le test à trente minutes ; cette durée est une commodité client, pas un plafond de dépenses garanti côté serveur. Un arrêt normal demande aussi la fermeture distante. En cas de fermeture brutale de l'onglet, l'interface libère le micro et la connexion ; une réservation peut rester bloquée jusqu'à 65 minutes. Un service de supervision serveur durable sera nécessaire avant un déploiement large pour imposer durée et budget par session et collecter les compteurs indépendamment du navigateur.

## Confidentialité du prototype

Le contexte envoyé comprend seulement le titre, les auteurs, la progression et l'indication de livre terminé. Les Traces, le profil, la bibliothèque complète et la conversation Hadrien ne sont pas importés automatiquement. L'audio va à OpenAI ; BOO-P ne l'enregistre pas. La transcription reste en mémoire de la fenêtre, téléchargeable par le testeur, puis effacée à la fermeture. Les identifiants techniques de session sont stockés côté serveur ; les lignes de plus de trente jours sont purgées lors de la prochaine réservation. L'effacement du compte supprime ses lignes par cascade.

La conservation du fournisseur est distincte : ne pas promettre une absence de conservation chez OpenAI. L'accès aux mineurs n'est pas ouvert par ce prototype. Il nécessite une étude dédiée des conditions fournisseur, des protections et de la rétention avant activation. La génération de fiches de réflexion, la sauvegarde dans le Carnet et la reprise d'une conversation seront une étape ultérieure.

## Vérification

`node --test tests/*.test.mjs` vérifie notamment refus d'accès, quotas, configuration serveur, erreurs et calcul des mesures. Un appel vocal réel reste indispensable après activation de la clé ; les simulations ne valident ni la qualité de la voix ni les permissions effectives du projet OpenAI.

Sources : https://developers.openai.com/api/docs/guides/realtime-webrtc ; https://developers.openai.com/api/docs/guides/realtime-costs ; https://developers.openai.com/api/docs/pricing ; https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing
