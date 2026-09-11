# Accès au compte et cadrage de l’avatar

Le lien « Mot de passe oublié ? » de la connexion appelle `resetPasswordForEmail`. Le retour ouvre un formulaire de nouveau mot de passe uniquement après une session de récupération Supabase valide. Un paramètre d’URL seul ne suffit pas. Le repère de parcours expire après une heure, reste limité à l’utilisateur et est supprimé après le changement de mot de passe. Les mots de passe ne sont pas conservés par BOO-P.

Redirection ajoutée et vérifiée dans Supabase le 11 septembre 2026 :
`https://credixbako-prog.github.io/boo-p-by-chatgpt/index.html?auth=recovery`

La Site URL existante et les redirections d’inscription sont conservées. En cas de changement de domaine, autoriser la nouvelle URL exacte dans Authentication → URL Configuration. Le modèle d’e-mail doit utiliser le lien de confirmation fourni par Supabase. Documentation : https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail

Vérifications : récupération valide et expirée, confirmation différente, erreur réseau, absence de divulgation d’un compte inexistant et blocage d’une ancienne session sans événement de récupération. Les tests de navigateur utilisent un fournisseur simulé ; aucun e-mail réel n’a été envoyé et aucun mot de passe réel n’a été modifié. La réception du message reste à vérifier avec le titulaire du compte.

L’avatar se cadre sur l’appareil avant l’envoi : déplacement, zoom et réglages au clavier. Le carré retenu est exporté en 512 × 512, puis traité par la compression et le stockage privés existants. Annuler préserve la sélection précédente. Tests du cadrage en portrait/paysage, des limites, de l’annulation et de la conservation des pixels choisis après enregistrement et rechargement.
