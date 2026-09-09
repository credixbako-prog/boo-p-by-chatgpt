# Test IA BOO-P

Deux modes sont disponibles : conversation texte avec dictée du navigateur (`reading-chat`, modèle `gpt-5-mini`) et voix Realtime (`reading-voice`, modèle `gpt-realtime-2.1`). La clé `OPENAI_API_KEY` reste dans les secrets Supabase. ChatGPT Pro ne finance pas ces appels API.

L’accès nécessite une session Supabase non anonyme, une autorisation administrateur `app_metadata.boop_ai_test = true` et une confirmation de participation majeure dans l’interface. Ce prototype ne doit pas être ouvert aux mineurs. Les valeurs `user_metadata` ne donnent aucun accès. L’ancienne liste `BOOP_VOICE_TESTER_IDS` reste également acceptée pour Realtime.

## Parcours

Le carnet dispose d’une lecture avec couverture et trois sections modifiables : Ce que je retiens, Ma réflexion personnelle, Questions à poursuivre. « Écrire librement » permet de rédiger ou coller un texte sans conversation ni appel à OpenAI. L’accès IA n’est vérifié qu’en ouvrant Conversation. Les brouillons sont conservés ; « Enregistrer mon texte » confirme uniquement une écriture locale réussie, puis la synchronisation habituelle peut la transférer au compte. Un échec de stockage garde l’éditeur ouvert et propose l’export du brouillon. Le sélecteur de couleur utilise le même bouton rond ◐ et les mêmes pastilles que les autres surfaces BOO-P, avec une préférence distincte pour le carnet (papier par défaut) et la conversation.

L’interface immersive ouvre le texte par défaut depuis « Ouvrir la réflexion ». Le choix Texte / Voix se fait à l’intérieur. « Ambiance » mémorise le fond bleu nuit, forêt, prune ou papier ; les informations et mesures restent accessibles dans « À propos ». La bibliothèque sépare désormais Livres, Carnet, Lexique et Sentier. Le Carnet regroupe les réflexions IA, pensées et citations ; le Lexique affiche les mots et expressions. Les filtres sont repliés par défaut. Les contrôles de saisie de la conversation utilisent une taille minimale de 16 px pour éviter le zoom automatique mobile, tout en conservant le zoom manuel.

Depuis un livre, cliquer sur Discuter du livre ou Mon carnet de réflexion. La session de lecture et le carnet général donnent aussi accès à l’espace associé au livre. Envoyer un message écrit ou dicter puis corriger avant envoi. Composer mon carnet utilise la conversation pour proposer une synthèse. Le brouillon reste séparé du carnet validé ; son ajout demande une action du lecteur. Les versions précédentes sont conservées, avec une limite de 20 versions.

Le mode Realtime est accessible depuis la fiche du livre ou la conversation texte. Il démarre une conversation vocale distincte, avec les informations du livre, sans importer automatiquement l’historique texte. Terminer coupe le microphone. Conserver cet échange pour mon carnet sauvegarde explicitement la transcription et ouvre le mode texte pour composer la synthèse. Sans cette action, la transcription reste en mémoire et disparaît à la fermeture. Les mesures vocales restent téléchargeables séparément.

Les conversations texte, brouillons et carnets sont enregistrés dans les données privées du livre, avec la synchronisation existante et l’export/suppression du compte. Les téléchargements déjà réalisés restent à la charge du lecteur. La dictée peut être traitée par un service distant du navigateur ; BOO-P n’envoie pas cet audio à OpenAI. Les conversations texte envoyées comprennent l’historique du carnet et le contexte minimal du livre, jamais toutes les notes de la bibliothèque.

## Limites du test

- Texte : 50 demandes par compte et 100 globalement par jour UTC, délai minimal de 5 secondes. Réservation atomique avant chaque appel, échecs compris. Historique maximal 80 messages et 60 000 caractères ; 1 800 tokens de sortie par réponse, 3 500 pour une synthèse, raisonnement compris.
- Voix : 3 créations par compte et 6 globalement par jour UTC, une session récente simultanée par compte. Arrêt à 30 minutes dans le navigateur, pas un plafond financier garanti côté serveur. Voir OPENAI_VOICE_SETUP.md.
- `store:false` pour Responses ne constitue pas une garantie Zero Data Retention. La politique de conservation OpenAI reste distincte.
- Export texte et impression/PDF simples disponibles. La maquette éditoriale illustrée et l’export Word ne sont pas encore intégrés.
- Des simulations valident les parcours sans facturation. Le premier vrai échange doit confirmer la clé, les crédits, l’accès aux modèles et la qualité vocale. Aucun crédit n’est acheté par l’application.

## Déploiement

Appliquer les migrations reading_voice_test puis reading_ai_test. Déployer les fonctions reading-voice et reading-chat. Elles vérifient elles-mêmes le bearer token avec Supabase Auth avant de vérifier les droits ; la vérification JWT de passerelle est donc désactivée. Ne pas retirer ces contrôles internes. Pour retirer le test à un compte, supprimer ou passer à false son attribut administrateur boop_ai_test et retirer son UUID de l’éventuelle liste vocale.

Les tables de quotas n’exposent aucune politique client, uniquement des droits service_role. Les entrées techniques expirent après 30 jours à la réservation suivante et lors de la suppression du compte.

Documentation : https://developers.openai.com/api/docs/guides/text et https://developers.openai.com/api/docs/guides/realtime-webrtc
