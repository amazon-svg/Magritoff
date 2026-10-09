# E4.ORDER-DOCUMENTS — preuve d’implémentation

Source : [story canonique](../../project/backlog/stories/E4.ORDER-DOCUMENTS.md).
Branche : `codex/correction-annexes-commandes`, dans le dossier habituel.
Spécification draft ; aucune approbation humaine revendiquée.

## Modules et contrat

`commercial-orders` orchestre le moteur existant `order-documents` ; lecture
PostgreSQL commune aux deux origines. Référence devis nullable, compte boutique
sans identifiant CRM accepté, repli sur nom/email acheteur. Total HT et montants
lignes déjà enregistrés ; TVA calculée en SQL numeric selon le régime tenant,
même convention que le détail/export actuel. Remises boutique masquées côté
serveur. Référence complète UUID si absence de numéro. Devise propagée aux
resolveurs partagés `quote-documents`, formatage décimal sans flottant ; devis
conservent EUR par défaut. Aucun nouveau moteur PDF.

Surface de commande compose le panneau existant ; bouton de production ouvert
aux commandes boutique. GET/POST `/commercial-orders/{orderId}/documents`
existants, OpenAPI clarifié et types dérivés régénérés, aucun nouveau DTO/endpoint.
Erreurs sans gabarit, seconde production et téléchargement conservées.

`order-upload-links` : le budget public ne peut pas être lu directement sous
RLS sans identité utilisateur. Migration 0097 ajoute une fonction minimale
security definer, search_path fixé, accessible uniquement au rôle API et
conditionnée au hash du jeton valide, non expiré/non révoqué. Renvoie seulement
les trois compteurs nécessaires. Confirmation existante garde verrous, quotas,
canal/audit et validation ; référence boutique alignée sur le contexte public.
Politiques RLS inchangées. Migration appliquée localement sans mutation métier.
Aucune dérogation R5 nouvelle.

## Vérifications

Dix tests PostgreSQL/S3 réels sur base temporaire supprimée après recette :
états vides/isolation ; PDF boutique téléchargé et relu avec pdf-lib, montants,
acheteur, absence de devis, refus sans gabarit et seconde génération ; fichier
boutique rattaché à une ligne puis téléchargé ; dépôt public hors identité HTTP,
quota, confirmation répétée, expiration et révocation. Tests historiques devis,
fichiers et liens adaptés au contexte authentifié réel, tous passent.

Quatre tests Chromium à 375/1280, réponses HTTP métier simulées : états vides,
génération PDF/reprise après gabarit manquant, dépôt fichier et création lien.
Captures relues ; suite intégrée au workflow a11y, exécution CI non revendiquée.
Test du resolveur : acheteur imprimé, absence de devis/remise et devise USD.
Régression : 3 158 tests réussis, 183 ignorés (dont les intégrations exécutées
séparément). Typage modulaire, build, OpenAPI et gouvernance passent.
Lecture locale : Atelier Lumière n’a pas de gabarit order prêt/actif/par défaut ;
sa configuration reste nécessaire pour produire le PDF sur cette boutique.

## Opérations et limites

Recette : [annexes](../../docs/testing/order-annexes.md).
Aucun serveur lancé/redémarré ; aucun fichier ou client métier créé par les
recettes dans la base de développement. Aucun push, fusion ou déploiement.
Le PDF boutique prend la TVA du tenant à sa génération puis reste conservé.
Aucun nouveau numéro attribué ; référentiels CRM et remises existants conservés.

## Correction du message de configuration

Retour de Xavier : « Aucun gabarit de bon de commande actif pour ce tenant ».
Lecture locale : BC 2026 est importé, prêt, actif et par défaut, mais comporte
zéro champ et aucun tableau de lignes ; le repository le refuse conformément
au contrat. Message serveur/client clarifié et lien vers Gabarits PDF proposé
sur le code existant order.document_template_missing. Aucun placement ajouté
implicitement au PDF de Xavier, aucun gabarit ou commande modifié.
234 tests ciblés (architecture/contrat/moteur), typage modulaire et deux parcours
Chromium mobile/ordinateur passent ; lien de configuration et sa disparition
après réussite vérifiés. Aucune dérogation R5, migration ou nouveau contrat.

## Diagnostic de l’enregistrement des champs

Capture de Xavier : erreur générique lors de la sauvegarde de BC 2026. La
reproduction du client HTTP complet jusqu’à PostgreSQL sur un gabarit temporaire
réussit (numéro de commande sans largeur, valeurs décimales, ETag et relecture).
La recette annexes compte désormais 12 tests PostgreSQL/S3 réussis. La cause de
l’échec sur le navigateur de Xavier n’est pas établie : nouvelle tentative avec
le message précis nécessaire. Aucun champ de BC 2026 modifié implicitement.

Module document-templates UI : erreurs API avec statut/code, validation locale
explicite et maintien des modifications ; libellés aperçu/total selon le type de
document et retour Gabarits PDF. Test Chromium : HTTP 500 visible, champ
conservé, reprise réussie et disparition de l’erreur. Types/build et 282 tests
ciblés passent. Aucun endpoint/DTO modifié, aucune dérogation R5 nouvelle.
