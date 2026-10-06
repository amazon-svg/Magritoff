# Compatibilité des anciennes routes Commande

Depuis le 6 octobre 2026, Magrit expose un seul objet Commande. La liste, la
fiche et les exports communs couvrent les origines boutique et devis.

## Routes canoniques

- `GET /api/v1/order-summaries`
- `GET /api/v1/order-summaries/{orderId}`
- `GET|POST /api/v1/order-exports`
- `GET /api/v1/order-exports/{exportId}`
- `/t/{tenantSlug}/dashboard/orders`
- `/t/{tenantSlug}/dashboard/orders/{orderId}`

## Façades de compatibilité

Les opérations suivantes restent fonctionnelles et lisent le stockage commun,
mais sont dépréciées depuis le 6 octobre 2026 :

- `GET /api/v1/commercial-orders`
- `GET /api/v1/commercial-orders/{orderId}`
- `GET|POST /api/v1/commercial-order-exports`
- `GET /api/v1/commercial-order-exports/{exportId}`

Le contrat OpenAPI porte `deprecated: true`. Les réponses réussies portent un
en-tête `Deprecation` conforme à RFC 9745 et un lien `successor-version` vers
la route commune correspondante. Leur comportement et leurs droits ne changent
pas pendant cette période.

L'ancienne page `/dashboard/commercial-orders` redirige vers la liste commune.
L'ancienne adresse `/dashboard/commercial-orders/{orderId}` monte la fiche
canonique et résout l'origine par la lecture commune.

Les sous-ressources qui n'ont pas encore de remplaçant commun restent actives
et ne sont pas dépréciées : changements d'étape, documents, fichiers et liens
de dépôt sous `/commercial-orders/{orderId}/...`. La conversion d'un devis
reste également un workflow actif distinct.

## Condition de retrait

Aucune date `Sunset` n'est publiée à ce stade. Le retrait ne peut être planifié
qu'après ces vérifications :

1. aucun écran Magrit actif n'utilise les anciennes lectures ou les anciens
   exports ;
2. les intégrations connues ont migré vers les routes communes ;
3. les sous-ressources encore actives disposent d'un chemin canonique, ou leur
   maintien sous l'ancien préfixe est explicitement acté ;
4. une date de retrait est annoncée dans le contrat et par l'en-tête `Sunset`.

Après la date annoncée, une route retirée devra répondre `410 Gone` avec le
code problème `api.version_retired` et un lien vers son remplaçant. Ce code ne
doit pas être activé avant la décision de retrait.

## Inventaire interne restant

La fiche et la boîte de changement d'étape lisent maintenant le détail commun.
Le composant historique `OrdersListPage` reste dans le module pour la période
de compatibilité, mais il n'est plus monté par le routeur : l'adresse historique
redirige avant son chargement. Il devra être supprimé avec ses helpers et tests
avant toute date `Sunset` sur `GET /commercial-orders`.
