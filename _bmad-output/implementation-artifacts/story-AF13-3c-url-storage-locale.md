---
id: AF13.3c
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF13.3b]
---

# AF13.3c — Corriger les URL Storage du runtime local

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Incident

Après upload d’un logo via l’API, Supabase Storage renvoyait une URL basée sur
`http://kong:8000`. Ce nom est résolu entre conteneurs Docker, mais pas par le
navigateur hôte ; le logo était donc enregistré mais son aperçu était cassé.

## Correction

- `magrit-api` dérive l’origine publique depuis les en-têtes du proxy ;
- le port transmis par `x-forwarded-port` est conservé et le runtime local se
  replie sur `54321` lorsque le proxy ne le fournit pas ;
- `MAGRIT_PUBLIC_SUPABASE_URL` permet une configuration explicite ;
- l’adaptateur remplace uniquement les URL dont l’hôte est `kong` ;
- les logos, hero et mockups déjà enregistrés avec cette origine sont corrigés
  à la lecture, y compris les URL loopback sans port, sans migration destructive ;
- les URL CDN externes restent inchangées.

## Validation UX attendue

Recharger l’éditeur : une ancienne URL `kong:8000` doit apparaître sous
`127.0.0.1:54321` et son aperçu doit fonctionner. Importer ensuite un nouveau
logo, enregistrer la boutique et vérifier son rendu dans la vitrine.
