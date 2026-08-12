---
id: AF23.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF22.2]
---
# AF23.1 — Rendre le diagnostic IA multi-provider

## Résultat livré

- sélection par `MAGRIT_AI_PROVIDER=anthropic|openai|mistral` ;
- clés dédiées `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` et `MISTRAL_API_KEY` ;
- modèle surchargeable avec `MAGRIT_AI_MODEL` ;
- protocoles de diagnostic propres aux trois fournisseurs derrière le même port ;
- compatibilité des anciens secrets Anthropic conservée ;
- absence de clé traitée comme une configuration incomplète, sans erreur serveur.

Cette story rend le diagnostic et la composition serveur multi-provider. Le chat
SSE de production reste encore derrière l'adaptateur legacy isolé par AF22.1 ;
son remplacement utilisera cette même sélection dans AF23.2.

## Configuration

```env
MAGRIT_AI_PROVIDER=openai
OPENAI_API_KEY=...
MAGRIT_AI_MODEL=gpt-4.1-mini
```

Pour Mistral, utiliser `MAGRIT_AI_PROVIDER=mistral` et `MISTRAL_API_KEY`. Sans
`MAGRIT_AI_PROVIDER`, Anthropic reste la valeur compatible par défaut.

## Validation attendue

Sans clé, le diagnostic indique « non configuré ». Avec une clé, il affiche le
fournisseur et le modèle sélectionnés, sans jamais renvoyer la clé au navigateur.
