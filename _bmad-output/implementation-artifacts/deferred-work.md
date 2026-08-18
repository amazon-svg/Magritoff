# Deferred Work

> Items reportés issus des code reviews BMAD. Pré-existants ou hors scope de la story où ils ont été détectés. À traiter dans des stories dédiées ou au prochain sprint qui touche le périmètre concerné.

## Deferred from: code review of story-S1.5-refactor-llm-finalisation (2026-05-10)

- **`isBillingError` / `isClaudeBillingError` regex permissive** — `/credit|billing|authentication/` (et `|invalid` côté make-server) match du texte arbitraire dans le body d'erreur. Pré-existant depuis le code original (S0/avant). Risque : un message d'erreur Anthropic légitime contenant un de ces mots déclenche un fallback démo silencieux. Fix proposé : matcher des patterns plus stricts ou des codes status précis. Story dédiée robustness wrapper recommandée.
- **Drift regex billing entre les 2 fichiers** — `supabase/functions/claude-proxy/index.ts` matche `/credit|billing|authentication/`, `supabase/functions/make-server-e3db71a4/index.ts` matche `/credit|billing|authentication|invalid/`. Pré-existant : reflète le comportement original de chaque endpoint. À harmoniser dans la même story que le point précédent.
- **`claude-proxy` standalone ne propage pas userId/tenantId** [`supabase/functions/claude-proxy/index.ts` : commentaire ligne ~807] — Pas de contexte auth dans cet endpoint, donc tracking `llm_usage_events` perd l'attribution user/tenant. Pré-existant (les endpoints PIM n'en ont pas non plus). Defer : à traiter dans une story d'instrumentation NFR23 quand on veut un dashboard usage par tenant complet.
- **Aucun AbortSignal/timeout sur `fetch` Anthropic** [`supabase/functions/_shared/anthropicClient.ts:184`, `:380`] — Pas de timeout configuré. Si Anthropic hang, l'edge function bloque jusqu'au kill platform (Supabase = ~150s). Pré-existant dans tout le codebase. Defer : story de robustness wrapper recommandée (ajouter `signal: AbortSignal.timeout(60_000)` partout).
