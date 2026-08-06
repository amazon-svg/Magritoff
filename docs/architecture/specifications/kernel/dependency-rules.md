# Règles de dépendances

**Statut :** candidate  
**S'applique à :** kernel, modules plateforme et modules métier

## Direction autorisée

```text
kernel
  ↑
platform
  ↑
domain ← application ← adapters
```

Dans un module métier :

```text
ui/api/mcp/jobs -> application -> domain
infrastructure  -> application ports et domain
```

Le domaine ne dépend jamais de l'application ou des adaptateurs. L'application dépend des ports qu'elle définit, pas de leurs implémentations.

## Matrice

| Depuis | Peut importer | Ne peut pas importer |
|---|---|---|
| `kernel` | bibliothèque standard, dépendances approuvées | plateforme, métier, React, Supabase |
| `platform/*/domain` | kernel | métier, React, Supabase |
| `platform/*/application` | kernel, domaine du même module, contrats plateforme autorisés | métier, adaptateurs |
| `modules/*/domain` | kernel | plateforme, React, Supabase, autre module |
| `modules/*/application` | kernel, son domaine, services plateforme publics | infrastructure, UI, tables d'un autre module |
| `modules/*/infrastructure` | kernel, contrats du module, SDK externes | UI |
| `modules/*/ui` | API publique application, UI partagée | repositories, tables, client Supabase |
| `modules/*/api|mcp` | API publique application | tables, composants React |

## Communication intermodules

Autorisée uniquement par :

- service public interne ;
- contrat de lecture explicitement publié ;
- événement versionné ;
- référence stable vers un objet public.

Interdite par :

- import d'un fichier interne ;
- lecture directe de table privée ;
- partage d'un composant contenant des règles métier ;
- dépendance circulaire ;
- accès au client Supabase d'un autre module.

## Dossiers partagés

`shared` n'est pas une destination par défaut. Un élément peut y entrer s'il est effectivement transversal, stable, sans ownership métier ambigu et accompagné d'un contrat public.

## Garde automatique attendue

La CI doit détecter :

- imports React/Supabase dans kernel et domain ;
- imports infrastructure depuis application ;
- imports internes entre modules ;
- cycles ;
- nouveaux appels `supabase.from`, `rpc` ou `functions.invoke` dans les composants.

## Exceptions

Une exception temporaire exige :

- un identifiant ;
- un propriétaire ;
- le motif ;
- les fichiers concernés ;
- une date ou condition de retrait ;
- un test empêchant son extension silencieuse.

## Critères d'acceptation

- [ ] Les règles sont exécutées en CI.
- [ ] Les imports publics passent par des points d'entrée déclarés.
- [ ] Aucun cycle kernel/plateforme/module n'existe.
- [ ] Une exception existante ne permet pas de nouvelles violations.
- [ ] Le rapport d'échec indique le chemin de dépendance interdit.
