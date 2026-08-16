---
id: UM2.1
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.4]
---
# UM2.1 — Poser la frontière de session storefront

## Résultat livré

- contrats de connexion et de session propres au module `shop-customers` ;
- invariants liant toujours l’identité, le profil et la même boutique ;
- profil storefront minimal sans `auth_subject_id` ni données workspace ;
- résultat JSON sans mot de passe, jeton ou identifiant Auth technique ;
- politique de cookie opaque `HttpOnly`, `SameSite=Lax`, `Path=/` ;
- cookie `__Host-` et `Secure` en production, nom local explicite en HTTP ;
- durée maximale de 24 heures et suppression par la même politique.

## Non livré dans cette story

- aucune route publique de connexion n’est activée ;
- aucun stockage de credential ou de session n’est choisi ;
- le checkout actuel n’est pas encore basculé ;
- la protection contre le brute force et la rotation sont obligatoires dans la
  story qui activera la route.

Cette séparation permet de choisir et tester le stockage serveur sans modifier le
contrat visible du navigateur.
