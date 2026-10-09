# E4.ORDER-ANNEXES — preuve d’implémentation

Source : [story canonique](../../project/backlog/stories/E4.ORDER-ANNEXES.md).
Branche : `codex/correction-annexes-commandes`, dossier habituel.
Spécification en brouillon ; aucune validation humaine revendiquée.

## Cause et correction

Commande signalée : `81419e86-4e1a-4316-aafa-2c28beb627cc`, tenant atelier-lumiere.
Lecture locale sans mutation : commande boutique existante, zéro fichier,
zéro lien de dépôt et aucun document. Les repositories historiques ne passaient
pas l’utilisateur à PostgreSQL ; la RLS masquait la commande. La lecture PDF
ajoutait une vérification de résumé limitée aux commandes issues de devis.

Composition Node : contexte AsyncLocalStorage alimenté après authentification,
résolution tenant, scopes et validation HTTP par un hook neutre de la façade.
Transaction runner : héritage de l’utilisateur uniquement pour le même tenant,
sans identité ni acteur explicites. Workers et transactions sans tenant exclus.
Aucune modification des politiques RLS ou privilèges. Les modules restent
propriétaires de leurs services, ports et composants ; composition seule dans
la surface de commande. Aucune dérogation R5.

Repository order-documents : validation de la table partagée tenant_orders,
puis lecture de la pièce ; service commercial-orders retire la vérification
quote-only. Contrat OpenAPI précise les deux origines et les codes existants,
types dérivés régénérés. Aucun nouveau endpoint ou DTO.
UI : génération indisponible explicitement pour les commandes boutique ;
génération devis et téléchargement conservés. État vide responsive.

## Vérifications

Deux tests PostgreSQL réels, base temporaire supprimée après recette : absence
reproduite sans identité, états vides avec acteur habilité, refus autre tenant,
autre utilisateur et commande inexistante. Lecture directe de la commande
signalée : files=0, links=0, document=null avec l’identité du propriétaire.
Aucun fichier, client ou commande de développement modifié.

Tests transaction runner : concurrence, sortie après erreur, tenant différent,
identité explicite, workers. Trois tests façade HTTP : propagation après
vérification utilisateur, refus sans authentification ou identité invalide.
Contrat commercial-orders vérifié. Régression : 3 157 tests réussis, 180 ignorés ;
typage modulaire et build réussis. Contrat OpenAPI et gouvernance documentaire
valides. Deux parcours Chromium à 375/1280 px avec
réponses HTTP simulées, captures relues : états vides, aucune erreur rouge,
absence du bouton de génération boutique. Suite ajoutée au workflow a11y ;
exécution CI et audit exhaustif d’accessibilité non revendiqués.

Reproduction : [recette](../../docs/testing/order-annexes.md).

## Limites

La génération PDF boutique reste à implémenter ; ce lot corrige la lecture et
l’affichage. Aucun serveur lancé ou redémarré, aucun push, fusion ou déploiement.
