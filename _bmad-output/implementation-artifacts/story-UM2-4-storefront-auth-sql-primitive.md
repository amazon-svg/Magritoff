---
id: UM2.4
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.3]
---
# UM2.4 — Rendre l’authentification SQL atomique

## Résultat livré

- primitive `api_authenticate_shop_customer` à refus unique et résultat vide ;
- résolution active de la boutique puis du couple boutique/email ;
- vérification factice lorsqu’une boutique, un compte ou un credential manque ;
- pré-hash SHA-256 puis bcrypt coûteux, sans limite fonctionnelle de 72 octets ;
- verrouillage de quinze minutes après cinq échecs ;
- verrou de ligne empêchant les courses sur le compteur ;
- remise à zéro après succès ;
- jeton aléatoire de 256 bits retourné une fois, seul son SHA-256 étant stocké ;
- session directe de huit heures créée dans la même transaction ;
- droits réduits à l’exécution de cette primitive pour le rôle `anon`.
- scénario SQL réel couvrant échec, succès, reset du compteur et hash du jeton.

## Non livré dans cette story

La fonction n’est pas encore appelée par une route HTTP et aucun credential
utilisateur n’est encore activé par le produit. L’adaptateur applicatif doit
d’abord adopter ce contrat atomique.
